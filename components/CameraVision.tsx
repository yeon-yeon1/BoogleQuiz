"use client";

import { useFaceTracking } from "@/lib/faceTracking";
import { useKioskStore } from "@/lib/stateMachine";

/**
 * Owns the camera + face detection pipeline. Renders no visible UI of its
 * own: it feeds presence/position events into the kiosk store. If the
 * camera/model never becomes available (permission denied, no camera,
 * offline), it silently opens a tap-anywhere fallback instead of surfacing
 * an error.
 */
export default function CameraVision() {
  const { videoRef, status } = useFaceTracking();
  const state = useKioskStore((s) => s.state);
  const manualStart = useKioskStore((s) => s.manualStart);

  return (
    <>
      {/* Off-screen capture surface; MediaPipe reads frames from this, nothing is shown. */}
      <video
        ref={videoRef}
        className="pointer-events-none absolute -z-10 h-1 w-1 opacity-0"
        muted
        playsInline
        autoPlay
      />

      {status === "unavailable" && state === "IDLE" && (
        <button
          type="button"
          aria-label="화면을 터치해서 시작하기"
          onClick={manualStart}
          className="absolute inset-0 z-0 h-full w-full cursor-pointer bg-transparent"
        />
      )}
    </>
  );
}
