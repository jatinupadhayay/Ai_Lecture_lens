const express = require('express');
const router = express.Router();
const { generateQuiz, attemptQuiz } = require('../controllers/quizController');
const { protect } = require('../middlewares/auth');

router.post('/generate', protect, generateQuiz);
router.post('/attempt', protect, attemptQuiz);

module.exports = router;
