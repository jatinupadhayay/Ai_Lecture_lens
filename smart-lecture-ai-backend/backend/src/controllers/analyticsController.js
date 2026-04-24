const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const Lecture = require('../models/Lecture');

/**
 * @desc  Get current student's performance analytics per lecture
 * @route GET /api/analytics/student
 * @access Private (student)
 */
exports.getStudentAnalytics = async (req, res) => {
  const studentId = req.user._id;

  // Get all attempts by this student, populate lecture title
  const attempts = await QuizAttempt.find({ student: studentId })
    .populate('lecture', 'title')
    .sort({ createdAt: 1 })
    .lean();

  // Group by lecture — keep all attempts for trend, surface best + latest
  const byLecture = {};
  for (const a of attempts) {
    const lid = a.lecture?._id?.toString() || a.lecture?.toString();
    const title = a.lecture?.title || 'Untitled Lecture';
    if (!byLecture[lid]) {
      byLecture[lid] = { lectureId: lid, title, attempts: [] };
    }
    byLecture[lid].attempts.push({
      score: a.score,
      total: a.total,
      createdAt: a.createdAt,
    });
  }

  const lectureStats = Object.values(byLecture).map((entry) => {
    const scores = entry.attempts.map((a) => a.score);
    const best = Math.max(...scores);
    const latest = scores[scores.length - 1];
    const avg = Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);
    return {
      lectureId: entry.lectureId,
      title: entry.title,
      attempts: entry.attempts,
      best,
      latest,
      avg,
      needsImprovement: avg < 70,
    };
  });

  // Sort: weak areas first
  lectureStats.sort((a, b) => a.avg - b.avg);

  // Overall stats
  const allScores = attempts.map((a) => a.score);
  const overallAvg =
    allScores.length > 0
      ? Math.round(allScores.reduce((s, x) => s + x, 0) / allScores.length)
      : 0;

  // Score history (chronological for line chart)
  const scoreHistory = attempts.map((a) => ({
    date: a.createdAt,
    score: a.score,
    lecture: a.lecture?.title || 'Quiz',
  }));

  res.json({
    overallAvg,
    totalAttempts: attempts.length,
    passed: allScores.filter((s) => s >= 70).length,
    lectureStats,
    scoreHistory,
  });
};

/**
 * @desc  Get leaderboard — all students ranked by average quiz score
 * @route GET /api/analytics/leaderboard
 * @access Private
 */
exports.getLeaderboard = async (req, res) => {
  // Aggregate: per student → avg score, attempt count
  const results = await QuizAttempt.aggregate([
    {
      $group: {
        _id: '$student',
        avgScore: { $avg: '$score' },
        attempts: { $sum: 1 },
        best: { $max: '$score' },
      },
    },
    { $sort: { avgScore: -1 } },
  ]);

  // Populate student names
  const studentIds = results.map((r) => r._id);
  const users = await User.find({ _id: { $in: studentIds } }, 'name email').lean();
  const userMap = {};
  for (const u of users) userMap[u._id.toString()] = u;

  const leaderboard = results.map((r, i) => {
    const user = userMap[r._id.toString()] || {};
    const isMe = r._id.toString() === req.user._id.toString();
    return {
      rank: i + 1,
      studentId: r._id,
      name: user.name || 'Unknown',
      email: user.email || '',
      avgScore: Math.round(r.avgScore),
      attempts: r.attempts,
      best: r.best,
      isMe,
    };
  });

  // Find current user's rank (they may not have any attempts yet)
  const myEntry = leaderboard.find((e) => e.isMe);

  res.json({ leaderboard, myRank: myEntry?.rank || null });
};
