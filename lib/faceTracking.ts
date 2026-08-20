"use client";

import { useEffect, useRef, useState } from "react";
import { useKioskStore, PRESENCE_MIN_BOX_RATIO } from "./stateMachine";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DETECT_INTERVAL_MS = 250;
const FACE_LOST_GRACE_MS = 1000;

// FaceLandmarker's 478-point mesh always includes iris landmarks (indices
// verified against the installed package's FaceLandmarker.FACE_LANDMARKS_*
// connection tables) — no separate "refine landmarks" flag needed like the
// legacy FaceMesh API. Index 1 is the nose tip, a standard stable proxy for
// overall head position.
const LANDMARK_NOSE_TIP = 1;
const RIGHT_EYE = { iris: 468, cornerA: 33, cornerB: 133, lidA: 159, lidB: 145 };
const LEFT_EYE = { iris: 473, cornerA: 362, cornerB: 263, lidA: 386, lidB: 374 };

/**
 * Real gaze direction is head turn *and* eyes-in-socket combined (the way
 * a person's actual gaze works) — head alone misses subtle glances where
 * someone barely turns their head at all (which is most of the time at
 * kiosk viewing distance), and iris-offset alone misses big head turns.
 * Weighted toward the iris signal on X, since that's the part head-only
 * tracking was missing and it's the more reliable of the two axes.
 *
 * Y is weighted the other way, much more toward head position. The
 * eyelid-gap denominator behind the vertical iris ratio is tiny to begin
 * with, and shrinks further when someone looks down at a tablet (their
 * eyes are naturally more hooded from the camera's angle) — a couple of
 * pixels of landmark noise in that gap swings the ratio wildly, which is
 * exactly the "flicks around when eyes move up/down a little" feedback.
 * Head Y doesn't have that problem, so it carries most of the weight here.
 */
const HEAD_WEIGHT_X = 0.3;
const IRIS_WEIGHT_X = 0.7;
const HEAD_WEIGHT_Y = 0.75;
const IRIS_WEIGHT_Y = 0.25;

/**
 * Below this eyelid-gap (normalized to frame height), the eye is too
 * close to closed/hooded for its vertical ratio to mean anything — a
 * near-zero denominator turns tiny landmark noise into a huge ratio
 * swing. Below the floor we just report a neutral 0.5 for that eye's Y
 * instead of an unstable number.
 */
const MIN_EYE_HEIGHT_RATIO = 0.015;

/**
 * FaceLandmarker gives relative eye-in-socket position, not an absolute
 * on-screen gaze point — that would need a per-person calibration pass
 * (look at these 4 corners) that a walk-up kiosk can't ask visitors to do.
 * Downstream (createGazeAmplifier), we sidestep that by only ever caring
 * about deviation from a self-calibrating rolling baseline rather than an
 * absolute position — see its comment for the full reasoning.
 */
function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function eyeRatio(
  landmarks: { x: number; y: number }[],
  eye: typeof RIGHT_EYE
): { x: number; y: number } {
  const iris = landmarks[eye.iris];
  const cornerA = landmarks[eye.cornerA];
  const cornerB = landmarks[eye.cornerB];
  const lidA = landmarks[eye.lidA];
  const lidB = landmarks[eye.lidB];

  const xMin = Math.min(cornerA.x, cornerB.x);
  const xMax = Math.max(cornerA.x, cornerB.x);
  const yMin = Math.min(lidA.y, lidB.y);
  const yMax = Math.max(lidA.y, lidB.y);
  const eyeHeight = yMax - yMin;

  return {
    x: xMax > xMin ? clamp01((iris.x - xMin) / (xMax - xMin)) : 0.5,
    y: eyeHeight > MIN_EYE_HEIGHT_RATIO ? clamp01((iris.y - yMin) / eyeHeight) : 0.5,
  };
}

/** Combines head position + both eyes' iris-in-socket ratio into one raw
 * 0..1 gaze signal, plus a face-width ratio for the presence/distance
 * check that used to come from FaceDetector's bounding box. */
function computeGazeSignal(landmarks: { x: number; y: number }[]) {
  const nose = landmarks[LANDMARK_NOSE_TIP];

  const right = eyeRatio(landmarks, RIGHT_EYE);
  const left = eyeRatio(landmarks, LEFT_EYE);
  const irisX = (right.x + left.x) / 2;
  const irisY = (right.y + left.y) / 2;

  const x = HEAD_WEIGHT_X * nose.x + IRIS_WEIGHT_X * irisX;
  const y = HEAD_WEIGHT_Y * nose.y + IRIS_WEIGHT_Y * irisY;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }

  return { x, y, widthRatio: maxX - minX };
}

/**
 * FaceLandmarker's eye/head signal is still noisy and (per kiosk, since
 * people look down at a tablet rather than straight into a webcam) rarely
 * centered at 0.5 — amplify deviation from a baseline before it reaches
 * the store. This is deliberately aggressive — even a small, subtle glance
 * should swing the character a lot; raise it further if it still feels
 * like it's just twitching in place.
 *
 * X is higher than Y on purpose: on QUIZ specifically, someone's eyes stay
 * inside the small, natural range of just reading the question and options
 * on screen — nowhere near rolling their eyes to the socket's limit — so
 * that whole reading range needs to map across most of the screen, not
 * just its own narrow slice. Y stays lower since it's the noisier of the
 * two axes (see MIN_EYE_HEIGHT_RATIO above).
 */
const GAZE_GAIN_X = 18;
const GAZE_GAIN_Y = 10;

/**
 * The kiosk camera isn't a face-on webcam call — people look down at a
 * tablet from above, so their "neutral, just looking at the screen" head
 * position in the raw camera frame is rarely dead-center (0.5, 0.5). If we
 * amplified around a fixed 0.5 the signal would just get clamped to one
 * edge and sit there, which read as "stuck at the bottom, barely moves."
 * Instead we track a slow-moving average of the raw position as the
 * baseline and amplify deviation from *that*, so whatever resting angle
 * this particular kiosk/person ends up at, small glances still swing the
 * character across the full range. This also quietly absorbs the lack of
 * per-person calibration on the iris ratio above — we never need to know
 * someone's "true" straight-ahead eye position, only how far they've
 * drifted from their own recent resting position.
 *
 * Kept deliberately slow (~a minute+ to fully recenter): if the character
 * itself is what someone's eyes are resting on — which it will be, since
 * that's the whole point — a fast-recentering baseline would keep chasing
 * that steady gaze back toward "deviation zero" and pull the character back
 * toward the middle even though the person never looked away. That reads
 * as "it won't hold still," which is the opposite of the goal: once
 * someone's gaze (and the character) settles somewhere, it should *stay*
 * there. See recenter() below for the one place we deliberately snap this
 * instantly instead of creeping — right as PRESENCE begins, before the
 * character's own position starts responding to gaze at all.
 */
const BASELINE_EMA_ALPHA = 0.004;

/**
 * Frame-to-frame detector noise (camera shake, motion blur, a flickering
 * background) rides along with genuine head/eye movement, and GAZE_GAIN=10
 * amplifies that noise right along with real glances — the shakier the
 * environment (e.g. a moving train), the twitchier the character looks.
 * This fast low-pass filter runs *before* the baseline/amplification step
 * to smooth that per-frame jitter out, while still tracking real movement
 * within a couple of detection ticks (~250-500ms) — not a noticeable lag,
 * but enough to average away single-frame noise spikes.
 */
const SMOOTHING_EMA_ALPHA = 0.35;

function createGazeAmplifier() {
  let smoothedX: number | null = null;
  let smoothedY: number | null = null;
  let baselineX: number | null = null;
  let baselineY: number | null = null;

  function amplify(rawX: number, rawY: number): [number, number] {
    if (smoothedX === null || smoothedY === null) {
      smoothedX = rawX;
      smoothedY = rawY;
    } else {
      smoothedX += (rawX - smoothedX) * SMOOTHING_EMA_ALPHA;
      smoothedY += (rawY - smoothedY) * SMOOTHING_EMA_ALPHA;
    }

    if (baselineX === null || baselineY === null) {
      baselineX = smoothedX;
      baselineY = smoothedY;
    } else {
      baselineX += (smoothedX - baselineX) * BASELINE_EMA_ALPHA;
      baselineY += (smoothedY - baselineY) * BASELINE_EMA_ALPHA;
    }

    return [
      Math.min(1, Math.max(0, 0.5 + (smoothedX - baselineX) * GAZE_GAIN_X)),
      Math.min(1, Math.max(0, 0.5 + (smoothedY - baselineY) * GAZE_GAIN_Y)),
    ];
  }

  function reset() {
    smoothedX = null;
    smoothedY = null;
    baselineX = null;
    baselineY = null;
  }

  /** Instantly snaps the baseline to the current smoothed position — used
   * right as active engagement begins (see the state-watching effect
   * below), so tracking starts from "wherever they're looking right now"
   * instead of carrying over whatever baseline IDLE had drifted to. */
  function recenter() {
    if (smoothedX === null || smoothedY === null) return;
    baselineX = smoothedX;
    baselineY = smoothedY;
  }

  return { amplify, reset, recenter };
}

export type FaceTrackingStatus = "initializing" | "ready" | "unavailable";

interface UseFaceTrackingResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: FaceTrackingStatus;
}

/**
 * Initializes the camera + MediaPipe FaceLandmarker on mount and
 * continuously feeds presence/position updates into the kiosk store. If
 * the camera or model fails to initialize (permission denied, no camera,
 * offline model fetch failure), status becomes "unavailable" so the UI can
 * fall back to tap-to-start instead of showing an error screen — but the
 * real reason is still logged to the console (prefixed "[faceTracking]")
 * so it's debuggable without breaking the silent-fallback UX.
 */
export function useFaceTracking(): UseFaceTrackingResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<FaceTrackingStatus>("initializing");
  const facePresent = useKioskStore((s) => s.facePresent);
  const faceLost = useKioskStore((s) => s.faceLost);
  const kioskState = useKioskStore((s) => s.state);
  const gazeAmplifierRef = useRef<ReturnType<typeof createGazeAmplifier> | null>(null);

  // The baseline barely drifts on its own now (see BASELINE_EMA_ALPHA), so
  // give it one deliberate, instant re-anchor right as PRESENCE begins —
  // the moment active engagement starts — rather than carrying over
  // whatever baseline IDLE happened to settle on.
  useEffect(() => {
    if (kioskState === "PRESENCE") gazeAmplifierRef.current?.recenter();
  }, [kioskState]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: import("@mediapipe/tasks-vision").FaceLandmarker | null =
      null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let lastSeenAt = 0;
    let loggedFirstDetection = false;
    const gazeAmplifier = createGazeAmplifier();
    gazeAmplifierRef.current = gazeAmplifier;

    async function createLandmarker(
      FaceLandmarker: typeof import("@mediapipe/tasks-vision").FaceLandmarker,
      fileset: Awaited<
        ReturnType<typeof import("@mediapipe/tasks-vision").FilesetResolver.forVisionTasks>
      >
    ) {
      try {
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn(
          "[faceTracking] GPU delegate failed, retrying with CPU delegate:",
          gpuError
        );
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }
    }

    async function init() {
      try {
        const { FaceLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) throw new Error("video element not mounted");
        video.srcObject = stream;
        await video.play();

        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        landmarker = await createLandmarker(FaceLandmarker, fileset);

        if (cancelled) return;
        console.info("[faceTracking] ready — camera + model initialized");
        setStatus("ready");

        intervalId = setInterval(() => {
          if (!video || !landmarker || video.readyState < 2) return;
          const result = landmarker.detectForVideo(video, performance.now());
          const landmarks = result.faceLandmarks[0];
          const now = Date.now();

          if (landmarks) {
            const { x, y, widthRatio } = computeGazeSignal(landmarks);
            if (widthRatio >= PRESENCE_MIN_BOX_RATIO) {
              if (!loggedFirstDetection) {
                loggedFirstDetection = true;
                console.info(
                  `[faceTracking] first face detected (widthRatio=${widthRatio.toFixed(3)}, threshold=${PRESENCE_MIN_BOX_RATIO})`
                );
              }
              lastSeenAt = now;
              // Mirror x because the camera preview is shown mirrored (selfie view).
              const rawX = 1 - clamp01(x);
              const rawY = clamp01(y);
              const [ampX, ampY] = gazeAmplifier.amplify(rawX, rawY);
              facePresent(ampX, ampY);
            }
          }

          if (lastSeenAt && now - lastSeenAt > FACE_LOST_GRACE_MS) {
            faceLost();
            gazeAmplifier.reset();
            lastSeenAt = 0;
          }
        }, DETECT_INTERVAL_MS);
      } catch (err) {
        console.error(
          "[faceTracking] camera/model init failed — falling back to tap-to-start:",
          err
        );
        if (!cancelled) setStatus("unavailable");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      landmarker?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, status };
}
