const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { geminiChat } = require("../services/gemini");
const Document = require("../models/Document");

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

const log = (...m) => console.log("[documentController]", ...m);
const errLog = (...m) => console.error("[documentController]", ...m);

// ─────────────────────────────────────────────────────────────────
// POST /api/documents/upload
// Accepts: multipart/form-data  { file, title }
// ─────────────────────────────────────────────────────────────────
exports.uploadDocument = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const title = req.body.title || path.parse(req.file.originalname).name;
  const ext = path.extname(req.file.originalname).replace(".", "").toLowerCase();

  // Create DB record immediately so frontend can poll status
  const doc = await Document.create({
    userId: req.user._id,
    title,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    fileType: ext,
    status: "processing",
  });

  // Kick off ingestion in background (don't await)
  _ingestDocument(doc._id.toString(), req.file.path, req.file.originalname, title).catch(
    (err) => errLog("Background ingest failed:", err.message)
  );

  res.status(201).json({ document: doc });
};

async function _ingestDocument(documentId, filePath, fileName, title) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), fileName);
    form.append("document_id", documentId);
    form.append("title", title);

    const response = await axios.post(`${PYTHON_AI_URL}/ingest-document`, form, {
      headers: form.getHeaders(),
      timeout: 120000,  // large PDFs can take time to embed
    });

    await Document.findByIdAndUpdate(documentId, {
      status: "ready",
      chunkCount: response.data.chunk_count,
      totalWords: response.data.total_words,
    });
    log(`Ingested document ${documentId}: ${response.data.chunk_count} chunks`);
  } catch (err) {
    errLog(`Ingest failed for ${documentId}:`, err.message);
    await Document.findByIdAndUpdate(documentId, {
      status: "failed",
      errorMessage: err.message,
    });
  } finally {
    // Clean up uploaded file
    fs.unlink(filePath, () => {});
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /api/documents
// List all documents for the authenticated user
// ─────────────────────────────────────────────────────────────────
exports.listDocuments = async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.source) filter.source = req.query.source;
  if (req.query.lectureId) filter.lectureId = req.query.lectureId;

  const docs = await Document.find(filter)
    .select("-chatHistory")
    .sort({ createdAt: -1 });
  res.json({ documents: docs });
};

// ─────────────────────────────────────────────────────────────────
// GET /api/documents/:id
// Get a single document (with chat history)
// ─────────────────────────────────────────────────────────────────
exports.getDocument = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) return res.status(404).json({ message: "Document not found" });
  res.json({ document: doc });
};

// ─────────────────────────────────────────────────────────────────
// DELETE /api/documents/:id
// ─────────────────────────────────────────────────────────────────
exports.deleteDocument = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) return res.status(404).json({ message: "Document not found" });

  // Remove vectors from ChromaDB
  try {
    await axios.delete(`${PYTHON_AI_URL}/delete-document/${doc._id}`, { timeout: 10000 });
  } catch (err) {
    errLog("Vector delete failed (continuing):", err.message);
  }

  await doc.deleteOne();
  res.json({ message: "Document deleted" });
};

// ─────────────────────────────────────────────────────────────────
// POST /api/documents/:id/chat
// Body: { message: string }
// RAG pipeline: retrieve context → ask OpenAI → return answer
// ─────────────────────────────────────────────────────────────────
exports.chatWithDocument = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: "`message` is required" });

  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) return res.status(404).json({ message: "Document not found" });
  if (doc.status !== "ready") {
    return res.status(400).json({ message: "Document is still being processed. Try again shortly." });
  }

  // 1. Retrieve relevant chunks from ChromaDB
  let contextChunks = [];
  try {
    const resp = await axios.post(`${PYTHON_AI_URL}/query-document`, {
      document_id: doc._id.toString(),
      query: message,
      top_k: 5,
    }, { timeout: 15000 });
    contextChunks = resp.data.chunks || [];
  } catch (err) {
    errLog("Vector query failed:", err.message);
    return res.status(500).json({ message: "Failed to search document. Please try again." });
  }

  // 2. Build RAG prompt
  const contextText = contextChunks
    .map((c, i) => `[Excerpt ${i + 1}]\n${c.text}`)
    .join("\n\n");

  const systemPrompt = `You are a helpful study assistant. The user is asking questions about a document titled "${doc.title}".
Answer ONLY based on the provided excerpts from the document. If the answer is not found in the excerpts, say so clearly.
Keep answers concise, accurate, and educational.`;

  // Include last 6 messages for conversational context
  const recentHistory = (doc.chatHistory || []).slice(-6).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const userMessage = `Document excerpts:\n\n${contextText}\n\n---\nQuestion: ${message}`;

  // 3. Call Gemini
  let answer = "";
  try {
    answer = await geminiChat(systemPrompt, userMessage, {
      maxTokens: 600,
      temperature: 0.3,
      history: recentHistory,
    });
  } catch (err) {
    errLog("Gemini chat failed:", err.message);
    // Fallback: return raw context chunks if Gemini is unavailable
    answer = `Here are the most relevant sections I found:\n\n${contextChunks.map((c) => c.text).join("\n\n")}`;
  }

  // 4. Persist chat history
  await Document.findByIdAndUpdate(doc._id, {
    $push: {
      chatHistory: {
        $each: [
          { role: "user", content: message },
          { role: "assistant", content: answer },
        ],
      },
    },
  });

  res.json({
    answer,
    sources: contextChunks.map((c) => ({
      text: c.text.slice(0, 200) + (c.text.length > 200 ? "..." : ""),
      score: c.score,
    })),
  });
};

// ─────────────────────────────────────────────────────────────────
// Reusable: create a Document record + ingest a local file
// Called from lectureController when a book PDF is attached to a lecture
// ─────────────────────────────────────────────────────────────────
exports.createAndIngestDocument = async ({ userId, title, filePath, fileName, fileSize, fileType, lectureId, lectureTitle }) => {
  const doc = await Document.create({
    userId,
    title,
    fileName,
    fileSize: fileSize || 0,
    fileType: fileType || "pdf",
    status: "processing",
    lectureId: lectureId || null,
    lectureTitle: lectureTitle || "",
    source: lectureId ? "lecture" : "standalone",
  });

  _ingestDocument(doc._id.toString(), filePath, fileName, title).catch(
    (err) => errLog("Background ingest (lecture book) failed:", err.message)
  );

  return doc;
};

// ─────────────────────────────────────────────────────────────────
// DELETE /api/documents/:id/chat
// Clear chat history for a document
// ─────────────────────────────────────────────────────────────────
exports.clearChat = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) return res.status(404).json({ message: "Document not found" });
  await Document.findByIdAndUpdate(doc._id, { $set: { chatHistory: [] } });
  res.json({ message: "Chat history cleared" });
};
