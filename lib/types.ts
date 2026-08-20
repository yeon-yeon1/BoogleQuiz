// Shared domain types for the kiosk app.

export type KioskState =
  | "IDLE"
  | "PRESENCE"
  | "GREETING"
  | "ENGAGE"
  | "QUIZ"
  | "LOADING"
  | "RESULT"
  | "ROULETTE";

export type CategoryKey = "bloating" | "gas" | "cramping" | "stool";

export type Intensity = "light" | "mid" | "dark";

export type ResultExpression = `${CategoryKey}-${Intensity}`;

/** Expressions used outside of the RESULT screen (idle/presence/greeting/quiz-follow). */
export type MoodExpression = "idle" | "surprised" | "happy" | "neutral" | "nod";

export type CharacterExpression = ResultExpression | MoodExpression;

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctIndex: number;
}

export interface QuizAnswerRecord {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
}

export interface ScoreResult {
  correct: number;
  total: number;
}

export interface LeadPayload {
  timestamp: string;
  quizAnswers: QuizAnswerRecord[];
  score: ScoreResult;
}
