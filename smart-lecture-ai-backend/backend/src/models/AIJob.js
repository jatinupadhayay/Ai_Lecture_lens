const mongoose = require('mongoose');

const aiJobSchema = new mongoose.Schema({
  lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' },
  taskType: { type: String, enum: ['transcribe','extract','summarize','quiz'] },
  status: { type: String, enum: ['pending','running','completed','failed'], default: 'pending' },
  logs: [String],
  result: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AIJob', aiJobSchema);
