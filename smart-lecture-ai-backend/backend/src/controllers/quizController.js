const Lecture = require('../models/Lecture');
const aiService = require('../services/aiService');

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

    // Call your AI model for quiz generation
    const quiz = await aiService.generateQuiz(context, 5);

    res.json({
      success: true,
      quiz: quiz.questions.map((q, i) => ({
        question: q,
        answer: quiz.answers[i]
      })),
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

    // TODO: implement scoring logic — compare with stored quiz answers
    const score = answers ? answers.length : 0;

    res.json({
      success: true,
      message: 'Quiz submitted successfully',
      score,
    });
  } catch (err) {
    console.error('Quiz attempt error:', err);
    res.status(500).json({ message: 'Failed to attempt quiz' });
  }
};
