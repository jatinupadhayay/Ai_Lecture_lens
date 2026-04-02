const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildQuestionsFromLecture,
  lectureToQuizPayload,
  parseQuizLines,
} = require("../src/controllers/quizController");

test("parseQuizLines parses MCQ blocks with answer keys", () => {
  const questions = parseQuizLines([
    "Q1. What is AI?",
    "A) Artificial Intelligence",
    "B) Automated Input",
    "C) Analog Interface",
    "D) Active Index",
    "Answer: A",
  ]);

  assert.equal(questions.length, 1);
  assert.equal(questions[0].question, "What is AI?");
  assert.deepEqual(questions[0].options, [
    "Artificial Intelligence",
    "Automated Input",
    "Analog Interface",
    "Active Index",
  ]);
  assert.equal(questions[0].correctAnswer, 0);
});

test("buildQuestionsFromLecture prefers structured quiz data", () => {
  const lecture = {
    quizStructured: [
      {
        question: "What is supervised learning?",
        options: ["Uses labels", "Uses no data", "Uses hardware", "Uses OCR"],
        correctAnswer: 0,
      },
    ],
    quiz: {
      merged: ["Fallback question"],
    },
  };

  const questions = buildQuestionsFromLecture(lecture);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].question, "What is supervised learning?");
  assert.equal(questions[0].correctAnswer, 0);
});

test("lectureToQuizPayload returns null when a lecture has no quiz content", () => {
  const payload = lectureToQuizPayload({
    _id: "lecture-1",
    title: "Empty Quiz Lecture",
    quizStructured: [],
    quiz: { local: [], ai: [], merged: [] },
  });

  assert.equal(payload, null);
});
