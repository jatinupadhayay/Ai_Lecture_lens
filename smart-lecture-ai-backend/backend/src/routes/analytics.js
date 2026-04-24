const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { getStudentAnalytics, getLeaderboard } = require('../controllers/analyticsController');

router.get('/student', protect, getStudentAnalytics);
router.get('/leaderboard', protect, getLeaderboard);

module.exports = router;
