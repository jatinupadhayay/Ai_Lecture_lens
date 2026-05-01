const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Queue } = require("bullmq");
const Lecture = require("../models/Lecture");
const { connection, isRedisAvailable } = require("../queues");
const { processLectureJob } = require("../services/lectureProcessing");
const { createAndIngestDocument } = require("./documentController");
const { geminiChat } = require("../services/gemini");

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

let aiQueue = null;

function getQueue() {
  if (!isRedisAvailable()) return null;
  // Upstash is serverless Redis — not compatible with BullMQ persistent connections
  if (process.env.REDIS_HOST?.includes('upstash.io')) return null;

  try {
    if (!aiQueue) aiQueue = new Queue("ai-jobs", { connection });
    return aiQueue;
  } catch {
    return null;
  }
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

function toWebUrl(filePath) {
  if (!filePath) return null;
  return `/${filePath.replace(/^[\\/]+/, "").replace(/\\/g, "/")}`;
}

function absPathFromUrl(url) {
  if (!url || isRemoteUrl(url)) return null;
  const relativePath = url.replace(/^\//, "");
  return path.resolve(__dirname, "../../", relativePath);
}

function hasLectureSource({ youtubeUrl, audioUrl, videoUrl, pptUrl }) {
  return Boolean(youtubeUrl || audioUrl || videoUrl || pptUrl);
}

function buildLectureJobPayload(lecture) {
  return {
    lectureId: lecture._id.toString(),
    videoPath: absPathFromUrl(lecture.videoUrl),
    videoUrl: isRemoteUrl(lecture.videoUrl) ? lecture.videoUrl : "",
    audioPath: absPathFromUrl(lecture.audioUrl),
    audioUrl: isRemoteUrl(lecture.audioUrl) ? lecture.audioUrl : "",
    pptPath: absPathFromUrl(lecture.pptUrl),
    pptUrl: isRemoteUrl(lecture.pptUrl) ? lecture.pptUrl : "",
    youtubeUrl: lecture.youtubeUrl || "",
  };
}

async function queueOrProcessLecture(lecture) {
  const jobPayload = buildLectureJobPayload(lecture);
  const queue = getQueue();

  if (queue) {
    await queue.add("processLecture", jobPayload);
    lecture.status = "queued";
    lecture.errorMessage = "";
    await lecture.save();

    return {
      lecture,
      processingMode: "queue",
      processingFailed: false,
      message: "Lecture uploaded and queued for AI processing.",
    };
  }

  try {
    const processedLecture = await processLectureJob(jobPayload);
    return {
      lecture: processedLecture,
      processingMode: "inline",
      processingFailed: false,
      message: "Lecture uploaded and processed inline.",
    };
  } catch (error) {
    const failedLecture = await Lecture.findById(lecture._id);
    return {
      lecture: failedLecture || lecture,
      processingMode: "inline",
      processingFailed: true,
      message: "Lecture uploaded, but processing failed.",
    };
  }
}

exports.uploadLecture = async (req, res) => {
  const { title, description = "", youtubeUrl = "", audioUrl = "" } = req.body;
  const teacher = req.user?._id;

  if (!title?.trim()) {
    return res.status(400).json({ error: "Title is required." });
  }

  const uploadsDir = path.join(__dirname, "../../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Cloudinary uploads return a URL in file.path; local disk uses filename
  const resolveFileUrl = (file) => {
    if (!file) return null;
    if (file.path && isRemoteUrl(file.path)) return file.path; // Cloudinary URL
    return toWebUrl(`uploads/${file.filename}`); // local path
  };

  const videoUrl = resolveFileUrl(req.files?.video?.[0]);
  const uploadedAudioUrl = resolveFileUrl(req.files?.audio?.[0]);
  const pptUrl = resolveFileUrl(req.files?.ppt?.[0]);
  const normalizedYoutubeUrl = youtubeUrl.trim();
  const normalizedAudioUrl = uploadedAudioUrl || audioUrl.trim() || null;

  if (
    !hasLectureSource({
      youtubeUrl: normalizedYoutubeUrl,
      audioUrl: normalizedAudioUrl,
      videoUrl,
      pptUrl,
    })
  ) {
    return res.status(400).json({
      error: "Provide at least one lecture source: video, audio, slides, or a YouTube URL.",
    });
  }

  const lecture = await Lecture.create({
    title: title.trim(),
    description: description.trim(),
    teacher,
    youtubeUrl: normalizedYoutubeUrl || null,
    videoUrl,
    audioUrl: normalizedAudioUrl,
    pptUrl,
    status: "uploaded",
  });

  // If book PDFs were uploaded, ingest each into vector DB in background
  const bookFiles = req.files?.book || [];
  if (bookFiles.length > 0) {
    const bookDocIds = [];
    for (const bookFile of bookFiles) {
      try {
        const bookDoc = await createAndIngestDocument({
          userId: teacher,
          title: `${title.trim()} — ${bookFile.originalname.replace(/\.[^/.]+$/, "")}`,
          filePath: bookFile.path,
          fileName: bookFile.originalname,
          fileSize: bookFile.size,
          fileType: path.extname(bookFile.originalname).replace(".", "").toLowerCase(),
          lectureId: lecture._id,
          lectureTitle: title.trim(),
        });
        bookDocIds.push(bookDoc._id);
      } catch (err) {
        console.error("[lectureController] Book ingest failed:", err.message);
      }
    }
    lecture.bookDocumentIds = bookDocIds;
    await lecture.save();
  }

  const result = await queueOrProcessLecture(lecture);

  return res.status(201).json(result);
};

exports.getLectures = async (req, res) => {
  const lectures = await Lecture.find({ teacher: req.user._id }).sort({ createdAt: -1 });
  res.json({ lectures });
};

exports.getLectureById = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id).populate("teacher", "name email");
  if (!lecture) {
    return res.status(404).json({ error: "Lecture not found" });
  }

  res.json(lecture);
};

exports.getLectureSummary = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "Lecture not found" });
  }

  res.json({
    summary: lecture.summary || {},
    status: lecture.status,
    errorMessage: lecture.errorMessage || "",
  });
};

exports.processLecture = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "Lecture not found" });
  }

  if (
    !hasLectureSource({
      youtubeUrl: lecture.youtubeUrl,
      audioUrl: lecture.audioUrl,
      videoUrl: lecture.videoUrl,
      pptUrl: lecture.pptUrl,
    })
  ) {
    return res.status(400).json({
      error: "No valid lecture media is attached to this record.",
    });
  }

  // Reset stuck processing state so the job can be re-queued cleanly
  if (lecture.status === "processing" || lecture.status === "failed") {
    lecture.status = "uploaded";
    lecture.errorMessage = "";
    await lecture.save();
  }

  const result = await queueOrProcessLecture(lecture);
  res.json(result);
};

exports.chatWithLecture = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: "`message` is required" });

  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ message: "Lecture not found" });
  if (lecture.status !== "completed") {
    return res.status(400).json({ message: "Lecture is still being processed. Try again shortly." });
  }

  // Query ChromaDB for relevant transcript chunks
  let contextChunks = [];
  try {
    const resp = await axios.post(
      `${PYTHON_AI_URL}/query-document`,
      { document_id: `lecture_${lecture._id}`, query: message, top_k: 5 },
      { timeout: 15000 }
    );
    contextChunks = resp.data.chunks || [];
  } catch (err) {
    console.error("[lectureController] Vector query failed:", err.message);
    return res.status(500).json({ message: "Failed to search lecture transcript. Please try again." });
  }

  if (contextChunks.length === 0) {
    return res.json({
      answer: "I couldn't find relevant content in this lecture to answer your question.",
      sources: [],
    });
  }

  const contextText = contextChunks.map((c, i) => `[Excerpt ${i + 1}]\n${c.text}`).join("\n\n");

  const systemPrompt = `You are a helpful study assistant. The user is asking questions about a lecture titled "${lecture.title}".
Answer ONLY based on the provided excerpts from the lecture transcript. If the answer is not found in the excerpts, say "This topic wasn't covered in the lecture."
Do not use any outside knowledge. Keep answers concise, accurate, and educational.`;

  const userMessage = `Lecture transcript excerpts:\n\n${contextText}\n\n---\nQuestion: ${message}`;

  let answer = "";
  try {
    answer = await geminiChat(systemPrompt, userMessage, { maxTokens: 600, temperature: 0.3 });
  } catch (err) {
    console.error("[lectureController] Gemini chat failed:", err.message);
    answer = `Here are the most relevant sections I found:\n\n${contextChunks.map((c) => c.text).join("\n\n")}`;
  }

  res.json({ answer, sources: contextChunks.map((c) => ({ text: c.text, score: c.score ?? 0 })) });
};

exports.getFlashcards = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id).select("flashcards status title");
  if (!lecture) return res.status(404).json({ message: "Lecture not found" });
  res.json({ flashcards: lecture.flashcards || [] });
};

exports.generateFlashcards = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ message: "Lecture not found" });
  if (lecture.status !== "completed") {
    return res.status(400).json({ message: "Lecture must be fully processed before generating flashcards." });
  }

  const content =
    lecture.summary?.merged ||
    lecture.summary?.ai ||
    lecture.summary?.local ||
    lecture.transcript?.map((t) => t.text).join(" ") ||
    "";

  if (!content) return res.status(400).json({ message: "No lecture content available to generate flashcards." });

  const count = parseInt(req.body.count) || 10;
  const systemPrompt = `You are a study assistant that creates concise, high-quality flashcards for students.
Each flashcard has a FRONT (question or term) and a BACK (answer or definition).
Also assign a short CATEGORY label (1-3 words, e.g. "Definition", "Concept", "Example", "Formula").
Generate exactly ${count} flashcards. Return ONLY a JSON array, no markdown.`;

  const userMessage = `Create ${count} flashcards from this lecture titled "${lecture.title}":\n\n${content.slice(0, 12000)}`;

  let flashcards;
  try {
    const { geminiJSON } = require("../services/gemini");
    const raw = await geminiJSON(systemPrompt, userMessage);
    const arr = Array.isArray(raw) ? raw : raw.flashcards || [];
    flashcards = arr
      .filter((c) => c.front && c.back)
      .map((c) => ({ front: String(c.front), back: String(c.back), category: String(c.category || "") }));
  } catch (err) {
    console.error("[lectureController] Flashcard generation failed:", err.message);
    return res.status(500).json({ message: "Flashcard generation failed. Please try again." });
  }

  lecture.flashcards = flashcards;
  await lecture.save();
  res.json({ flashcards });
};

exports.deleteLecture = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ error: "Lecture not found" });

  // Only the owner can delete
  if (lecture.teacher?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: "Not authorized." });
  }

  await Lecture.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
};

// POST /api/lectures/:id/books  — add books to an existing lecture
exports.uploadBookToLecture = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ error: "Lecture not found" });

  const bookFiles = req.files?.book || [];
  if (bookFiles.length === 0) return res.status(400).json({ error: "No book files provided." });

  const newDocIds = [];
  const newDocs = [];
  for (const bookFile of bookFiles) {
    try {
      const bookDoc = await createAndIngestDocument({
        userId: req.user._id,
        title: bookFile.originalname.replace(/\.[^/.]+$/, ""),
        filePath: bookFile.path,
        fileName: bookFile.originalname,
        fileSize: bookFile.size,
        fileType: path.extname(bookFile.originalname).replace(".", "").toLowerCase(),
        lectureId: lecture._id,
        lectureTitle: lecture.title,
      });
      newDocIds.push(bookDoc._id);
      newDocs.push(bookDoc);
    } catch (err) {
      console.error("[lectureController] uploadBookToLecture failed:", err.message);
    }
  }

  // Append to existing books array
  lecture.bookDocumentIds = [...(lecture.bookDocumentIds || []), ...newDocIds];
  await lecture.save();

  res.status(201).json({ books: newDocs });
};

module.exports = {
  ...module.exports,
  buildLectureJobPayload,
  hasLectureSource,
};
