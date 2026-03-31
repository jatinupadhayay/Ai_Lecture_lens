const express = require('express');
const router = express.Router();
const { generateQuiz, attemptQuiz, getQuizByLecture } = require('../controllers/quizController');
const { protect } = require('../middlewares/auth');

router.get('/lecture/:lectureId', protect, getQuizByLecture);
router.post('/generate', protect, generateQuiz);
router.post('/attempt', protect, attemptQuiz);

module.exports = router;
