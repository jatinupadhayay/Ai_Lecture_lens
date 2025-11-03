const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionIndex: Number,
  question: String,
  selected: String,
  correct: { type: Boolean, default: false }
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema({
  lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  answers: [answerSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
