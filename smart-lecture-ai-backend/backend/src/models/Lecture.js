const mongoose = require('mongoose')

// 🎧 Transcript per line
const transcriptSchema = new mongoose.Schema(
  {
    start: Number,
    end: Number,
    text: String,
  },
  { _id: false }
)

// 🖼️ Frame (optional, for future visual AI)
const frameSchema = new mongoose.Schema(
  {
    time: Number,
    text: String,
    imageUrl: String,
  },
  { _id: false }
)

// 🧠 Summary versions
const summarySchema = new mongoose.Schema(
  {
    local: String,
    ai: String,
    merged: String,
  },
  { _id: false }
)

// 🎓 Lecture schema
const lectureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ✅ Media sources (all optional)
    youtubeUrl: { type: String },
    videoUrl: { type: String },
    audioUrl: { type: String },
    pptUrl: { type: String },

    // ✅ Processing state
    status: {
  type: String,
  enum: ['uploaded', 'queued', 'processing', 'completed', 'failed'],
  default: 'uploaded',
},

    // ✅ AI-generated data
    transcript: [transcriptSchema],
    frames: [frameSchema],
    summary: summarySchema,

    // ✅ Quiz generated from lecture
    quiz: {
      local: [{ type: String }],
      ai: [{ type: String }],
      merged: [{ type: String }],
    },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Lecture', lectureSchema)
