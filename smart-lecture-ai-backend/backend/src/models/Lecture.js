const mongoose = require("mongoose");

const transcriptSchema = new mongoose.Schema(
  {
    start: Number,
    end: Number,
    text: String,
  },
  { _id: false }
);

const frameSchema = new mongoose.Schema(
  {
    time: Number,
    text: String,
    imageUrl: String,
  },
  { _id: false }
);

const summarySchema = new mongoose.Schema(
  {
    local: String,
    ai: String,
    merged: String,
  },
  { _id: false }
);

const lectureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    youtubeUrl: { type: String },
    videoUrl: { type: String },
    audioUrl: { type: String },
    pptUrl: { type: String },
    status: {
      type: String,
      enum: ["uploaded", "queued", "processing", "completed", "failed"],
      default: "uploaded",
    },
    errorMessage: { type: String, default: "" },
    transcript: [transcriptSchema],
    frames: [frameSchema],
    summary: summarySchema,
    quiz: {
      local: [{ type: String }],
      ai: [{ type: String }],
      merged: [{ type: String }],
    },
    quizStructured: [
      {
        question: { type: String },
        options: [{ type: String }],
        correctAnswer: { type: Number, default: 0 },
      },
    ],
    bookDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lecture", lectureSchema);
