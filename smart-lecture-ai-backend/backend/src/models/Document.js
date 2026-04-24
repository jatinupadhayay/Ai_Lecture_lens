const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },       // bytes
    fileType: { type: String, default: "pdf" },   // pdf | docx | txt
    status: {
      type: String,
      enum: ["uploading", "processing", "ready", "failed"],
      default: "uploading",
    },
    errorMessage: { type: String, default: "" },
    chunkCount: { type: Number, default: 0 },
    totalWords: { type: Number, default: 0 },
    // If attached to a lecture
    lectureId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecture", default: null, index: true },
    lectureTitle: { type: String, default: "" },
    source: { type: String, enum: ["standalone", "lecture"], default: "standalone" },

    // Chat history for this document
    chatHistory: [
      {
        role: { type: String, enum: ["user", "assistant"] },
        content: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
