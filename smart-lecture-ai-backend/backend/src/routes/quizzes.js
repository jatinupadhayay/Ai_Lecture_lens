const express = require('express');
const router = express.Router();
const { generateQuiz, attemptQuiz, getAllQuizzes, getQuizByLecture } = require('../controllers/quizController');
const { protect } = require('../middlewares/auth');

router.get('/', protect, getAllQuizzes);
router.get('/lecture/:lectureId', protect, getQuizByLecture);
router.post('/generate', protect, generateQuiz);
router.post('/attempt', protect, attemptQuiz);

module.exports = router;
