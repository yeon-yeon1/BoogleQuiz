import type { QuizQuestion } from "@/lib/types";

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "quiz-1",
    prompt: "부글은 어떤 서비스일까요?",
    options: [
      { id: "quiz-1-a", label: "장 질환을 진단하는 의료 서비스" },
      { id: "quiz-1-b", label: "배변 상태와 생활 습관을 기록하고, 쌓인 기록의 패턴을 확인하는 서비스" },
      { id: "quiz-1-c", label: "의약품을 추천하고 처방하는 서비스" },
      { id: "quiz-1-d", label: "운동량만 기록하는 피트니스 서비스" },
    ],
    correctIndex: 1,
  },
  {
    id: "quiz-2",
    prompt: "부글에서는 배변 상태와 함께 어떤 정보를 기록할 수 있을까요?",
    options: [
      { id: "quiz-2-a", label: "수면, 수분, 식사, 운동, 스트레스 등의 생활 습관" },
      { id: "quiz-2-b", label: "혈압과 혈당 등의 의료 검사 결과만" },
      { id: "quiz-2-c", label: "스마트폰 사용 시간과 배터리 사용량" },
      { id: "quiz-2-d", label: "다른 사용자의 배변 기록" },
    ],
    correctIndex: 0,
  },
  {
    id: "quiz-3",
    prompt: "부글에서 기록한 내용을 날짜별로 모아 확인할 수 있는 기능은 무엇일까요?",
    options: [
      { id: "quiz-3-a", label: "프로필" },
      { id: "quiz-3-b", label: "가이드" },
      { id: "quiz-3-c", label: "캘린더" },
      { id: "quiz-3-d", label: "리포트" },
    ],
    correctIndex: 2,
  },
  {
    id: "quiz-4",
    prompt: "부글의 리포트는 AI가 사용자의 장 건강 데이터를 진단해서 생성해준다.",
    options: [
      { id: "quiz-4-a", label: "O" },
      { id: "quiz-4-b", label: "X" },
    ],
    correctIndex: 1,
  },
  {
    id: "quiz-5",
    prompt: "부글에서 사용자의 기록을 참고해 생활 관리에 도움이 되는 정보를 제공하는 기능은 무엇일까요?",
    options: [
      { id: "quiz-5-a", label: "캘린더" },
      { id: "quiz-5-b", label: "배변 기록" },
      { id: "quiz-5-c", label: "맞춤형 생활 가이드" },
      { id: "quiz-5-d", label: "리포트" },
    ],
    correctIndex: 2,
  },
];
