require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { spawnSync, execFileSync } = require("child_process");
const FormData = require("form-data");
const Groq = require("groq-sdk");
const { geminiChat, geminiJSON } = require("./gemini");

// ── Python / FastAPI config ──
const PYTHON_VENV_PATH = process.env.PYTHON_PATH || "python";
const AI_MODELS_DIR = path.join(__dirname, "../ai_models");
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";
const TRANSCRIBE_URL = process.env.TRANSCRIBE_SERVICE_URL || `${PYTHON_AI_URL}/transcribe`;
const EXTRACT_URL = process.env.EXTRACT_SERVICE_URL || `${PYTHON_AI_URL}/extract`;
const QUIZ_URL = process.env.QUIZ_SERVICE_URL || `${PYTHON_AI_URL}/quiz`;
const SUMMARIZE_URL = process.env.SUMMARIZE_SERVICE_URL || `${PYTHON_AI_URL}/summarize`;
const CLEAN_URL = process.env.CLEAN_SERVICE_URL || `${PYTHON_AI_URL}/clean`;

// ── Groq client (for Whisper + LLM fallback) ──
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const log = (...msg) => console.log("[aiService]", ...msg);
const errLog = (...msg) => console.error("[aiService]", ...msg);

/* ===========================================================
   Text preparation — clean + extract key sentences
   =========================================================== */
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","this","that","these",
  "those","it","its","we","they","he","she","you","i","so","as","by","from",
]);

function extractKeyContent(text, maxChars = 6000) {
  const sentences = text
    .replace(/([.?!])\s+/g, "$1\n")
    .split("\n")
    .map(s => s.trim())
    .filter(s => s.length > 20);

  if (!sentences.length) return text.slice(0, maxChars);

  const wordFreq = {};
  const tokenized = sentences.map(s => {
    const words = s.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w));
    words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    return { s, words };
  });

  const scored = tokenized.map(({ s, words }) => ({
    s,
    score: words.length ? words.reduce((sum, w) => sum + wordFreq[w], 0) / words.length : 0,
  }));

  scored.sort((a, b) => b.score - a.score);
  const topSet = new Set(scored.slice(0, Math.ceil(sentences.length * 0.6)).map(x => x.s));

  const parts = [];
  let len = 0;
  for (const s of sentences.filter(s => topSet.has(s))) {
    if (len + s.length + 1 > maxChars) break;
    parts.push(s);
    len += s.length + 1;
  }
  return parts.join(" ") || text.slice(0, maxChars);
}

exports.prepareText = async (rawText) => {
  if (!rawText) return "";
  log("prepareText input length:", rawText.length);

  let cleaned = rawText;

  if (CLEAN_URL) {
    try {
      const res = await axios.post(CLEAN_URL, { text: rawText }, { timeout: 60000 });
      cleaned = res.data?.text || rawText;
    } catch (err) {
      errLog("FastAPI clean failed, using raw text:", err.message);
    }
  } else {
    const cleanTmp = path.join(os.tmpdir(), `lns_prep_${Date.now()}.txt`);
    try {
      fs.writeFileSync(cleanTmp, rawText, "utf8");
      const res = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "cleaner.py"), cleanTmp], { encoding: "utf8" });
      cleaned = res.stdout?.toString().trim() || rawText;
    } catch (err) {
      errLog("Local clean failed:", err.message);
    } finally {
      fs.rmSync(cleanTmp, { force: true });
    }
  }

  const prepared = extractKeyContent(cleaned, 6000);
  log("prepareText output length:", prepared.length);
  return prepared;
};

/* ===========================================================
   Helper: send file to FastAPI endpoint
   =========================================================== */
async function sendFileToService(url, filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), path.basename(filePath));
  const res = await axios.post(url, form, {
    headers: form.getHeaders(),
    timeout: 600000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return res.data;
}

/* ===========================================================
   Download from URL
   =========================================================== */
async function downloadFileFromUrl(fileUrl, outDir, prefix = "audio") {
  log("Downloading:", fileUrl);
  if (!fileUrl) throw new Error("No URL provided");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ext = path.extname(fileUrl).split("?")[0] || ".mp3";
  const filePath = path.join(outDir, `${prefix}_${Date.now()}${ext}`);
  const writer = fs.createWriteStream(filePath);

  const response = await axios({ url: fileUrl, method: "GET", responseType: "stream", timeout: 60000 });
  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  log("Download complete:", filePath);
  return filePath;
}

/* ===========================================================
   Download YouTube via yt-dlp
   =========================================================== */
function findYtDlp() {
  for (const cmd of [process.env.YT_DLP_PATH, "yt-dlp", "yt-dlp.exe"].filter(Boolean)) {
    try { execFileSync(cmd, ["--version"], { stdio: "pipe" }); return cmd; } catch {}
  }
  throw new Error("yt-dlp not found. Install: https://github.com/yt-dlp/yt-dlp#installation");
}

async function downloadYouTubeVideo(url, outDir) {
  log("Downloading YouTube via yt-dlp:", url);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ytDlp = findYtDlp();
  const outTemplate = path.join(outDir, `youtube_${Date.now()}.%(ext)s`);

  const result = spawnSync(ytDlp, [
    url,
    "--format", "bestaudio/best",
    "--output", outTemplate,
    "--no-playlist", "--no-warnings", "--no-update", "--quiet",
  ], { encoding: "utf8", timeout: 300000 });

  if (result.status !== 0) {
    throw new Error(`yt-dlp failed: ${result.stderr?.trim() || result.error?.message || "unknown"}`);
  }

  const files = fs.readdirSync(outDir)
    .map(f => path.join(outDir, f))
    .filter(f => f.includes("youtube_") && fs.statSync(f).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (!files.length) throw new Error("yt-dlp ran but no output file found");
  log("YouTube saved:", files[0]);
  return files[0];
}

/* ===========================================================
   Transcription
   Priority: Groq Whisper API → FastAPI local Whisper → spawnSync
   =========================================================== */
exports.transcribe = async (filePath) => {
  log("Transcribing:", filePath);

  // ── 1. Groq Whisper API (~10s for a full lecture, free) ──
  if (groqClient) {
    try {
      log("Transcribing via Groq Whisper API...");
      const transcription = await groqClient.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-large-v3-turbo",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      const segments = (transcription.segments || [])
        .filter(s => s.text?.trim())
        .map(s => ({ start: round2(s.start), end: round2(s.end), text: s.text.trim() }));

      log(`Groq Whisper: ${segments.length} segments`);
      if (segments.length > 0) return segments;
    } catch (err) {
      errLog("Groq Whisper failed, falling back:", err.message);
    }
  }

  // ── 2. FastAPI local Whisper ──
  if (TRANSCRIBE_URL) {
    try {
      const data = await sendFileToService(TRANSCRIBE_URL, filePath);
      log("Transcription via FastAPI:", Array.isArray(data) ? data.length : "ok");
      return Array.isArray(data) ? data : data.transcript || [];
    } catch (err) {
      errLog("FastAPI transcribe failed, falling back to local:", err.message, err.code || "");
    }
  }

  // ── 3. Local spawnSync fallback ──
  try {
    const result = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "transcriber.py"), filePath], { encoding: "utf8" });
    if (result.error) throw new Error(result.error.message);
    return JSON.parse(result.stdout.toString().trim() || "[]");
  } catch (err) {
    errLog("Local transcribe failed:", err.message);
    return [];
  }
};

function round2(n) { return Math.round(n * 100) / 100; }

/* ===========================================================
   Frame / Slide Extraction
   =========================================================== */
exports.extract = async (filePath) => {
  log("Extracting frames:", filePath);

  if (EXTRACT_URL) {
    try {
      const data = await sendFileToService(EXTRACT_URL, filePath);
      log("Extraction via FastAPI:", data.frames?.length || "ok");
      return data.frames || data;
    } catch (err) {
      errLog("FastAPI extract failed, falling back to local:", err.message);
    }
  }

  try {
    const result = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "extractor.py"), filePath], { encoding: "utf8" });
    if (result.error) throw new Error(result.error.message);
    return JSON.parse(result.stdout.toString().trim() || "[]");
  } catch (err) {
    errLog("Local extract failed:", err.message);
    return [];
  }
};

/* ===========================================================
   Vector store helpers
   =========================================================== */
async function queryVectors(documentId, query, topK = 5) {
  try {
    const resp = await axios.post(
      `${PYTHON_AI_URL}/query-document`,
      { document_id: documentId, query, top_k: topK },
      { timeout: 15000 }
    );
    return resp.data.chunks || [];
  } catch (err) {
    errLog(`Vector query failed for ${documentId}:`, err.message);
    return [];
  }
}

exports.ingestLectureText = async (lectureId, text) => {
  if (!text?.trim()) return false;
  try {
    await axios.post(
      `${PYTHON_AI_URL}/ingest-text`,
      { document_id: `lecture_${lectureId}`, text, title: `Lecture ${lectureId}` },
      { timeout: 120000 }
    );
    log(`Ingested lecture transcript for ${lectureId}`);
    return true;
  } catch (err) {
    errLog(`Lecture text ingest failed for ${lectureId}:`, err.message);
    return false;
  }
};

/* ===========================================================
   Quiz Generation (Gemini/Groq LLM + local Flan-T5)
   =========================================================== */
exports.generateQuiz = async (text, numQuestions = 5, { lectureId, bookDocumentIds = [] } = {}) => {
  log(`Generating quiz, text length: ${text?.length || 0}`);
  let localQuiz = [];
  let aiQuiz = [];
  let aiQuizStructured = [];

  // ── Semantic context from ChromaDB ──
  let semanticContext = "";
  if (lectureId) {
    const allChunks = [];
    const lectureChunks = await queryVectors(`lecture_${lectureId}`, "key concepts definitions examples", 6);
    allChunks.push(...lectureChunks);
    for (const bookId of bookDocumentIds) {
      allChunks.push(...await queryVectors(bookId, "key concepts definitions", 3));
    }
    if (allChunks.length > 0) {
      semanticContext = allChunks.map((c, i) => `[Section ${i + 1}]\n${c.text}`).join("\n\n");
      log(`Quiz semantic context: ${allChunks.length} chunks`);
    }
  }

  const quizContent = semanticContext || text;

  // ── Local Flan-T5 quiz via FastAPI ──
  let localQuizStructured = [];
  if (QUIZ_URL) {
    try {
      const data = await axios.post(QUIZ_URL, { text: quizContent, num_questions: numQuestions }, { timeout: 120000 });
      const result = data.data;
      if (result.structured && Array.isArray(result.structured)) localQuizStructured = result.structured;
      if (result.questions) localQuiz = result.questions.map(q => typeof q === "string" ? q : q.question || JSON.stringify(q));
      log("Quiz via FastAPI:", localQuiz.length, "questions");
    } catch (err) {
      errLog("FastAPI quiz failed:", err.message);
    }
  }

  // ── Gemini/Groq structured quiz ──
  try {
    const systemPrompt = `You are an educational AI. Generate multiple-choice quizzes as JSON.
Return ONLY: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0}]}
correctAnswer is 0-based index. Generate exactly ${numQuestions} questions.
Make questions test understanding. Each option should be plausible. Avoid "All of the above".`;

    const parsed = await geminiJSON(systemPrompt, `Generate ${numQuestions} MCQs from:\n${quizContent}`);

    if (parsed.questions && Array.isArray(parsed.questions)) {
      aiQuizStructured = parsed.questions;
      const letters = ["A", "B", "C", "D"];
      aiQuiz = parsed.questions.map((q, i) => {
        const opts = q.options.map((o, j) => `${letters[j]}) ${o}`).join("\n");
        return `Q${i + 1}. ${q.question}\n${opts}\nAnswer: ${letters[q.correctAnswer] || "A"}`;
      });
      log("LLM structured quiz:", aiQuizStructured.length, "questions");
    }
  } catch (err) {
    errLog("LLM quiz failed:", err.message);
  }

  const finalStructured = aiQuizStructured.length > 0 ? aiQuizStructured : localQuizStructured;

  return {
    localQuiz,
    aiQuiz,
    mergedQuiz: [...localQuiz, "---", ...aiQuiz],
    aiQuizStructured: finalStructured,
  };
};

/* ===========================================================
   Summarization (Gemini/Groq LLM + local BART)
   =========================================================== */
exports.dualSummarize = async (cleanText, { lectureId, bookDocumentIds = [] } = {}) => {
  log("Summarizing, text length:", cleanText?.length || 0);
  let localSummary = "";
  let aiSummary = "";

  // ── Semantic retrieval from ChromaDB ──
  let semanticContext = "";
  if (lectureId) {
    const allChunks = [];
    for (const q of ["main topics and key concepts", "important definitions and explanations", "examples and applications"]) {
      allChunks.push(...await queryVectors(`lecture_${lectureId}`, q, 4));
    }
    for (const bookId of bookDocumentIds) {
      allChunks.push(...await queryVectors(bookId, "relevant theory and concepts", 3));
    }
    const seen = new Set();
    const unique = allChunks.filter(c => {
      const key = `${c.chunk_index ?? c.text?.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    if (unique.length > 0) {
      semanticContext = unique.map((c, i) => `[Section ${i + 1}]\n${c.text}`).join("\n\n");
      log(`Summary semantic context: ${unique.length} chunks`);
    }
  }

  // ── Local BART (only when no semantic context) ──
  if (!semanticContext && SUMMARIZE_URL) {
    try {
      const res = await axios.post(SUMMARIZE_URL, { text: cleanText }, { timeout: 120000 });
      localSummary = res.data?.summary || "";
      log("FastAPI summary length:", localSummary.length);
    } catch (err) {
      errLog("FastAPI summarize failed:", err.message);
    }
  }

  // ── Gemini/Groq summary ──
  try {
    const contentToSummarize = semanticContext || cleanText;
    const hasBooks = bookDocumentIds?.length > 0;
    const systemPrompt = semanticContext
      ? `You are an expert educational AI. Generate a comprehensive, well-structured summary from the lecture content${hasBooks ? " and supplementary book material" : ""}. Use this format:\n\n## Overview\n## Key Concepts\n## Important Details\n## Takeaways\n\nBe concise, clear, and educational.`
      : "You are a helpful summarization assistant for lecture notes. Provide a clear, structured summary with key points and takeaways. Use markdown formatting with headers.";

    aiSummary = await geminiChat(systemPrompt, contentToSummarize, { maxTokens: 4096, temperature: 0.3 });
    log("LLM summary length:", aiSummary.length);
  } catch (err) {
    errLog("LLM summarize failed:", err.message);
  }

  return { localSummary, aiSummary };
};

/* ===========================================================
   Prepare Inputs
   =========================================================== */
exports.prepareInputs = async ({ videoPath, audioPath, pptPath, youtubeUrl, audioUrl, tmpDir }) => {
  log("Preparing inputs:", { videoPath, audioPath, pptPath, youtubeUrl, audioUrl });
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    if (videoPath && fs.existsSync(videoPath)) return { videoPath, cleanupPaths: [] };
    if (youtubeUrl) {
      const downloaded = await downloadYouTubeVideo(youtubeUrl, tmpDir);
      return { videoPath: downloaded, cleanupPaths: [downloaded] };
    }
    if (audioPath && fs.existsSync(audioPath)) return { audioPath, cleanupPaths: [] };
    if (audioUrl) {
      const downloaded = await downloadFileFromUrl(audioUrl, tmpDir, "audio");
      return { audioPath: downloaded, cleanupPaths: [downloaded] };
    }
    if (pptPath && fs.existsSync(pptPath)) return { pptPath, cleanupPaths: [] };

    log("No valid input found");
    return { cleanupPaths: [] };
  } catch (err) {
    errLog("prepareInputs failed:", err.message);
    return { cleanupPaths: [] };
  }
};
