const Lecture = require('../models/Lecture');
const QuizAttempt = require('../models/QuizAttempt');
const aiService = require('../services/aiService');

/**
 * @desc Get quiz data for a specific lecture
 * @route GET /api/quizzes/lecture/:lectureId
 * @access Private
 */
exports.getQuizByLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.lectureId);
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

    if (!lecture.quiz || (!lecture.quiz.merged?.length && !lecture.quiz.local?.length && !lecture.quiz.ai?.length)) {
      return res.json({ quizzes: [] });
    }

    const quizLines = lecture.quiz.merged?.length ? lecture.quiz.merged
      : lecture.quiz.ai?.length ? lecture.quiz.ai
      : lecture.quiz.local || [];

    // Parse raw quiz lines into structured questions
    const questions = parseQuizLines(quizLines);

    res.json({
      quizzes: questions.length > 0 ? [{
        id: lecture._id.toString(),
        lectureId: lecture._id.toString(),
        title: `Quiz: ${lecture.title}`,
        questions,
      }] : [],
    });
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ message: 'Failed to fetch quiz' });
  }
};

/**
 * Parse raw quiz text lines into structured MCQ objects.
 * Handles formats like:
 *   Q1. What is X?\nA) option1\nB) option2\nC) option3\nD) option4\nAnswer: A
 * Falls back to simple question/answer pairs if MCQ format is not detected.
 */
function parseQuizLines(lines) {
  const text = lines.join('\n');
  const questions = [];

  // Try to parse MCQ format: look for question + options + answer blocks
  const mcqPattern = /(?:Q?\d+[.)]\s*)?(.+?)\n\s*[Aa][.)]\s*(.+?)\n\s*[Bb][.)]\s*(.+?)\n\s*[Cc][.)]\s*(.+?)\n\s*[Dd][.)]\s*(.+?)(?:\n\s*(?:Answer|Correct)[:\s]*([A-Da-d]))?/g;
  let match;

  while ((match = mcqPattern.exec(text)) !== null) {
    const [, question, optA, optB, optC, optD, correctLetter] = match;
    const answerMap = { a: 0, b: 1, c: 2, d: 3 };
    const correctAnswer = correctLetter ? (answerMap[correctLetter.toLowerCase()] ?? 0) : 0;

    questions.push({
      id: `q-${questions.length}`,
      question: question.trim(),
      options: [optA.trim(), optB.trim(), optC.trim(), optD.trim()],
      correctAnswer,
    });
  }

  // Fallback: if no MCQs were parsed, create simple true/false style from raw lines
  if (questions.length === 0) {
    const filteredLines = lines.filter(l => l.trim() && l.trim() !== '---');
    for (let i = 0; i < filteredLines.length; i++) {
      const line = filteredLines[i].trim();
      if (!line) continue;
      questions.push({
        id: `q-${i}`,
        question: line,
        options: ['True', 'False', 'Not mentioned', 'Cannot determine'],
        correctAnswer: 0,
      });
    }
  }

  return questions;
}

/**
 * @desc Generate a quiz from a lecture transcript or uploaded text
 * @route POST /api/quizzes/generate
 * @access Private
 */
exports.generateQuiz = async (req, res) => {
  try {
    const { lectureId, text } = req.body;

    let context = text;
    if (!context && lectureId) {
      const lecture = await Lecture.findById(lectureId);
      if (!lecture) return res.status(404).json({ message: 'Lecture not found' });
      context = (lecture.transcript || []).map(s => s.text).join(' ');
    }

    if (!context) return res.status(400).json({ message: 'No text or lecture data provided' });

    const quizResult = await aiService.generateQuiz(context, 5);

    // Store quiz on lecture if lectureId provided
    if (lectureId) {
      await Lecture.findByIdAndUpdate(lectureId, {
        quiz: {
          local: quizResult.localQuiz || [],
          ai: quizResult.aiQuiz || [],
          merged: quizResult.mergedQuiz || [],
        },
      });
    }

    const questions = parseQuizLines(quizResult.mergedQuiz || []);

    res.json({
      success: true,
      quiz: questions,
    });
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ message: 'Failed to generate quiz' });
  }
};

/**
 * @desc Attempt a quiz (student answers submission)
 * @route POST /api/quizzes/attempt
 * @access Private
 */
exports.attemptQuiz = async (req, res) => {
  try {
    const { quizId, answers } = req.body;

    // quizId is the lecture ID in our case
    const lecture = await Lecture.findById(quizId);
    if (!lecture) return res.status(404).json({ message: 'Quiz not found' });

    const quizLines = lecture.quiz?.merged?.length ? lecture.quiz.merged
      : lecture.quiz?.ai?.length ? lecture.quiz.ai
      : lecture.quiz?.local || [];

    const questions = parseQuizLines(quizLines);

    // Score the answers
    let correct = 0;
    const detailedAnswers = questions.map((q, i) => {
      const isCorrect = answers[i] === q.correctAnswer;
      if (isCorrect) correct++;
      return {
        questionIndex: i,
        question: q.question,
        selected: q.options[answers[i]] || 'N/A',
        correct: isCorrect,
      };
    });

    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Save the attempt
    await QuizAttempt.create({
      lecture: quizId,
      student: req.user._id,
      score,
      total,
      answers: detailedAnswers,
    });

    res.json({
      success: true,
      message: 'Quiz submitted successfully',
      score,
      correct,
      total,
    });
  } catch (err) {
    console.error('Quiz attempt error:', err);
    res.status(500).json({ message: 'Failed to attempt quiz' });
  }
};
