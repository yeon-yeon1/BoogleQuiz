import { create } from "zustand";
import type { KioskState, QuizAnswerRecord, ScoreResult } from "./types";
import { QUIZ_QUESTIONS } from "@/data/quizQuestions";

export const PRESENCE_MIN_BOX_RATIO = 0.06; // fraction of frame width a face bbox must cover

/** How long a face must be continuously detected before the character wakes up. */
export const PRESENCE_DWELL_MS = 3000;

// Not reactive state on purpose — this is a plain setTimeout handle, not
// something a component should re-render on.
let presenceDwellTimer: ReturnType<typeof setTimeout> | null = null;

function clearPresenceDwellTimer() {
  if (presenceDwellTimer) {
    clearTimeout(presenceDwellTimer);
    presenceDwellTimer = null;
  }
}

interface KioskStore {
  state: KioskState;

  /** Live camera-tracked face signal (also driven by manual/touch fallback). */
  faceDetected: boolean;
  /** Normalized 0..1 face position, top-left origin. Null when no signal. */
  faceX: number | null;
  faceY: number | null;

  quizAnswers: QuizAnswerRecord[];
  quizIndex: number;

  // -- transitions --
  goTo: (state: KioskState) => void;
  facePresent: (x: number, y: number) => void;
  faceLost: () => void;
  manualStart: () => void;
  advanceToGreeting: () => void;
  advanceToEngage: () => void;
  advanceToQuiz: () => void;
  answerQuiz: (questionId: string, selectedIndex: number) => void;
  startLoading: () => void;
  showResult: () => void;
  /** Visitor self-reports having followed on Instagram — gates the roulette. */
  confirmFollow: () => void;
  reset: () => void;
}

export const useKioskStore = create<KioskStore>((set, get) => ({
  state: "IDLE",
  faceDetected: false,
  faceX: null,
  faceY: null,
  quizAnswers: [],
  quizIndex: 0,

  goTo: (state) => set({ state }),

  facePresent: (x, y) => {
    const { state } = get();
    set({ faceDetected: true, faceX: x, faceY: y });

    // A face showing up doesn't wake the character immediately — it has to
    // hold "eye contact" for PRESENCE_DWELL_MS first. Until then the
    // character just drifts toward them while still asleep.
    if (state === "IDLE" && !presenceDwellTimer) {
      presenceDwellTimer = setTimeout(() => {
        presenceDwellTimer = null;
        if (get().state === "IDLE") {
          set({ state: "PRESENCE" });
        }
      }, PRESENCE_DWELL_MS);
    }
  },

  faceLost: () => {
    const { state } = get();
    set({ faceDetected: false });
    clearPresenceDwellTimer();
    if (state === "PRESENCE") {
      set({ state: "IDLE", faceX: null, faceY: null });
    }
  },

  manualStart: () => {
    const { state } = get();
    if (state === "IDLE") {
      clearPresenceDwellTimer();
      set({ state: "PRESENCE", faceDetected: true, faceX: 0.5, faceY: 0.5 });
    }
  },

  advanceToGreeting: () =>
    set((s) => (s.state === "PRESENCE" ? { state: "GREETING" } : {})),

  advanceToEngage: () =>
    set((s) => (s.state === "GREETING" ? { state: "ENGAGE" } : {})),

  advanceToQuiz: () =>
    set((s) => (s.state === "ENGAGE" ? { state: "QUIZ" } : {})),

  answerQuiz: (questionId, selectedIndex) => {
    const { quizAnswers, quizIndex } = get();
    const question = QUIZ_QUESTIONS[quizIndex];
    if (!question || question.id !== questionId) return;

    const record: QuizAnswerRecord = {
      questionId,
      selectedIndex,
      correct: selectedIndex === question.correctIndex,
    };

    const nextAnswers = [...quizAnswers, record];
    const nextIndex = quizIndex + 1;
    const isLastQuestion = nextIndex >= QUIZ_QUESTIONS.length;

    set({
      quizAnswers: nextAnswers,
      quizIndex: nextIndex,
      state: isLastQuestion ? "LOADING" : "QUIZ",
    });
  },

  startLoading: () => set({ state: "LOADING" }),
  showResult: () => set({ state: "RESULT" }),

  confirmFollow: () =>
    set((s) => (s.state === "RESULT" ? { state: "ROULETTE" } : {})),

  reset: () => {
    clearPresenceDwellTimer();
    set({
      state: "IDLE",
      faceDetected: false,
      faceX: null,
      faceY: null,
      quizAnswers: [],
      quizIndex: 0,
    });
  },
}));

export function getScoreResult(quizAnswers: QuizAnswerRecord[]): ScoreResult {
  return {
    correct: quizAnswers.filter((a) => a.correct).length,
    total: QUIZ_QUESTIONS.length,
  };
}
