const Lecture = require("../models/Lecture");
const QuizAttempt = require("../models/QuizAttempt");
const User = require("../models/User");
const aiService = require("../services/aiService");

function parseQuizLines(lines = []) {
  const normalizedLines = lines
    .map((line) => line.trim())
    .filter((line) => line && line !== "---");
  const questions = [];
  const optionPatterns = [/^[Aa][.)]\s+/, /^[Bb][.)]\s+/, /^[Cc][.)]\s+/, /^[Dd][.)]\s+/];
  const answerMatchPattern = /^(?:Answer|Correct)[:\s]*([A-Da-d])$/;

  for (let index = 0; index < normalizedLines.length; ) {
    const hasMcqShape =
      index + 4 < normalizedLines.length &&
      optionPatterns.every((pattern, offset) => pattern.test(normalizedLines[index + offset + 1]));

    if (!hasMcqShape) {
      questions.push({
        id: `q-${questions.length}`,
        question: normalizedLines[index],
        options: ["True", "False", "Not mentioned", "Cannot determine"],
        correctAnswer: 0,
      });
      index += 1;
      continue;
    }

    const options = optionPatterns.map((pattern, offset) =>
      normalizedLines[index + offset + 1].replace(pattern, "").trim()
    );
    const answerLine = normalizedLines[index + 5] || "";
    const answerMatch = answerLine.match(answerMatchPattern);
    const answerMap = { a: 0, b: 1, c: 2, d: 3 };

    questions.push({
      id: `q-${questions.length}`,
      question: normalizedLines[index].replace(/^(?:Q?\d+[.)]\s*)/, "").trim(),
      options,
      correctAnswer: answerMatch ? answerMap[answerMatch[1].toLowerCase()] ?? 0 : 0,
    });

    index += answerMatch ? 6 : 5;
  }

  return questions;
}

function buildQuestionsFromLecture(lecture) {
  if (lecture.quizStructured?.length) {
    return lecture.quizStructured.map((question, index) => ({
      id: `q-${index}`,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
    }));
  }

  const quizLines = lecture.quiz?.merged?.length
    ? lecture.quiz.merged
    : lecture.quiz?.ai?.length
      ? lecture.quiz.ai
      : lecture.quiz?.local || [];

  return parseQuizLines(quizLines);
}

function lectureToQuizPayload(lecture) {
  const questions = buildQuestionsFromLecture(lecture);

  if (!questions.length) {
    return null;
  }

  return {
    id: lecture._id.toString(),
    lectureId: lecture._id.toString(),
    title: `Quiz: ${lecture.title}`,
    questions,
  };
}

exports.getAllQuizzes = async (req, res) => {
  const lectures = await Lecture.find({
    $or: [
      { "quizStructured.0": { $exists: true } },
      { "quiz.merged.0": { $exists: true } },
      { "quiz.ai.0": { $exists: true } },
      { "quiz.local.0": { $exists: true } },
    ],
  }).sort({ createdAt: -1 });

  const quizzes = lectures
    .map(lectureToQuizPayload)
    .filter(Boolean);

  res.json({ quizzes });
};

exports.getQuizByLecture = async (req, res) => {
  const lecture = await Lecture.findById(req.params.lectureId);
  if (!lecture) {
    return res.status(404).json({ message: "Lecture not found" });
  }

  const quiz = lectureToQuizPayload(lecture);
  res.json({ quizzes: quiz ? [quiz] : [] });
};

exports.generateQuiz = async (req, res) => {
  const { lectureId, text } = req.body;
  let context = text;

  if (!context && lectureId) {
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    context = (lecture.transcript || []).map((segment) => segment.text).join(" ");
  }

  if (!context) {
    return res.status(400).json({ message: "No text or lecture data provided" });
  }

  const quizResult = await aiService.generateQuiz(context, 5);

  if (lectureId) {
    await Lecture.findByIdAndUpdate(lectureId, {
      quiz: {
        local: quizResult.localQuiz || [],
        ai: quizResult.aiQuiz || [],
        merged: quizResult.mergedQuiz || [],
      },
      quizStructured: quizResult.aiQuizStructured || [],
    });
  }

  res.json({
    success: true,
    quiz: parseQuizLines(quizResult.mergedQuiz || []),
  });
};

exports.attemptQuiz = async (req, res) => {
  const { quizId, answers } = req.body;

  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: "Answers must be an array." });
  }

  const lecture = await Lecture.findById(quizId);
  if (!lecture) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  const questions = buildQuestionsFromLecture(lecture);
  if (!questions.length) {
    return res.status(400).json({ message: "This lecture does not have a quiz yet." });
  }

  let correct = 0;
  const detailedAnswers = questions.map((question, index) => {
    const isCorrect = answers[index] === question.correctAnswer;
    if (isCorrect) correct += 1;

    return {
      questionIndex: index,
      question: question.question,
      selected: question.options[answers[index]] || "N/A",
      correct: isCorrect,
    };
  });

  const total = questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  const attempt = await QuizAttempt.create({
    lecture: quizId,
    student: req.user._id,
    score,
    total,
    answers: detailedAnswers,
  });

  await User.findByIdAndUpdate(req.user._id, {
    $push: {
      scores: score,
      quizAttempts: {
        quizId,
        score,
        completedAt: attempt.createdAt,
      },
    },
  });

  res.json({
    success: true,
    message: "Quiz submitted successfully",
    score,
    correct,
    total,
    attempt: {
      id: attempt._id.toString(),
      quizId,
      score,
      completedAt: attempt.createdAt,
    },
  });
};

module.exports = {
  ...module.exports,
  buildQuestionsFromLecture,
  lectureToQuizPayload,
  parseQuizLines,
};
