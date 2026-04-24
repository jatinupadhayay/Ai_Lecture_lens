require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { spawnSync, execFileSync } = require("child_process");
const FormData = require("form-data");
<<<<<<< HEAD
const Groq = require("groq-sdk");
=======
>>>>>>> main
const { geminiChat, geminiJSON } = require("./gemini");

const PYTHON_VENV_PATH = process.env.PYTHON_PATH || "python";
<<<<<<< HEAD
const AI_MODELS_DIR = path.join(__dirname, "../ ai_models");
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";
=======
const AI_MODELS_DIR = path.join(__dirname, "../ai_models");

// FastAPI service base URL (for vector store + direct endpoints)
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

// FastAPI service URLs (preferred)
>>>>>>> main
const TRANSCRIBE_URL = process.env.TRANSCRIBE_SERVICE_URL || null;
const EXTRACT_URL = process.env.EXTRACT_SERVICE_URL || null;
const QUIZ_URL = process.env.QUIZ_SERVICE_URL || null;
const SUMMARIZE_URL = process.env.SUMMARIZE_SERVICE_URL || null;
const CLEAN_URL = process.env.CLEAN_SERVICE_URL
  || (SUMMARIZE_URL ? SUMMARIZE_URL.replace("/summarize", "/clean") : null);
<<<<<<< HEAD

const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
=======
>>>>>>> main

const log = (...msg) => console.log("[aiService]", ...msg);
const errLog = (...msg) => console.error("[aiService]", ...msg);
const GROQ_MAX_UPLOAD_BYTES = 24 * 1024 * 1024;

function axiosErrorDetail(err) {
  const detail = err.response?.data?.detail || err.response?.data?.error || err.response?.data;
  if (detail) {
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }
  return err.message;
}

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

<<<<<<< HEAD
=======
/* ===========================================================
   Text preparation — clean + extract key sentences
   Reduces token count before sending to AI models
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

  // Tokenize once per sentence, build freq map and scores in one pass
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

  // Try FastAPI cleaner first
  if (CLEAN_URL) {
    try {
      const res = await axios.post(CLEAN_URL, { text: rawText }, { timeout: 60000 });
      cleaned = res.data?.text || rawText;
      log("FastAPI cleaner output length:", cleaned.length);
    } catch (err) {
      errLog("FastAPI clean failed, using raw text:", err.message);
    }
  } else {
    // Local cleaner via spawnSync
    const cleanTmp = path.join(os.tmpdir(), `lns_prep_${Date.now()}.txt`);
    try {
      fs.writeFileSync(cleanTmp, rawText, "utf8");
      const res = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "cleaner.py"), cleanTmp], { encoding: "utf8" });
      if (res.status !== 0) errLog("cleaner.py stderr:", res.stderr);
      cleaned = res.stdout?.toString().trim() || rawText;
    } catch (err) {
      errLog("Local clean failed:", err.message);
    } finally {
      fs.rmSync(cleanTmp, { force: true });
    }
  }

  // Extract key sentences and cap length
  const prepared = extractKeyContent(cleaned, 6000);
  log("prepareText output length:", prepared.length, `(saved ~${rawText.length - prepared.length} chars)`);
  return prepared;
};

/* ===========================================================
   Helper: send file to FastAPI endpoint via multipart upload
   =========================================================== */
>>>>>>> main
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

<<<<<<< HEAD
function findYtDlp() {
  for (const cmd of [process.env.YT_DLP_PATH, "yt-dlp", "yt-dlp.exe"].filter(Boolean)) {
    try { execFileSync(cmd, ["--version"], { stdio: "pipe" }); return cmd; } catch {}
  }
  throw new Error("yt-dlp not found.");
}

function findFfmpeg() {
  for (const cmd of [process.env.FFMPEG_PATH, "ffmpeg", "ffmpeg.exe"].filter(Boolean)) {
    try { execFileSync(cmd, ["-version"], { stdio: "pipe" }); return cmd; } catch {}
  }
  try {
    const bundled = execFileSync(
      PYTHON_VENV_PATH,
      ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"],
      { encoding: "utf8", stdio: "pipe" }
    ).trim();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {}
  return null;
}

function prepareWhisperFile(filePath) {
  const size = fs.statSync(filePath).size;
  if (size <= GROQ_MAX_UPLOAD_BYTES && ![".mp4", ".mkv", ".webm", ".mov", ".avi"].includes(path.extname(filePath).toLowerCase())) {
    return { filePath, cleanupPath: null };
  }

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return { filePath, cleanupPath: null };

  const outPath = path.join(path.dirname(filePath), `whisper_${Date.now()}.mp3`);
  const result = spawnSync(ffmpeg, [
    "-y",
    "-i", filePath,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-b:a", "32k",
    outPath,
  ], { encoding: "utf8", timeout: 300000 });

  if (result.status !== 0 || !fs.existsSync(outPath)) {
    errLog("ffmpeg audio compression failed:", result.stderr?.trim() || result.error?.message || "unknown");
    return { filePath, cleanupPath: null };
  }

  const compressedSize = fs.statSync(outPath).size;
  log(`Compressed audio for Whisper: ${Math.round(size / 1024 / 1024)}MB -> ${Math.round(compressedSize / 1024 / 1024)}MB`);
  return { filePath: outPath, cleanupPath: outPath };
=======
/* ===========================================================
   Download YouTube Video via yt-dlp (reliable, actively maintained)
   =========================================================== */
function findYtDlp() {
  // Prefer project-local or venv yt-dlp, fall back to system PATH
  const candidates = [
    process.env.YT_DLP_PATH,
    "yt-dlp",
    "yt-dlp.exe",
  ].filter(Boolean);

  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ["--version"], { stdio: "pipe" });
      return cmd;
    } catch {
      // not found, try next
    }
  }
  throw new Error("yt-dlp not found. Install it: https://github.com/yt-dlp/yt-dlp#installation");
>>>>>>> main
}

async function downloadYouTubeVideo(url, outDir) {
  log("Downloading YouTube via yt-dlp:", url);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ytDlp = findYtDlp();
  const outTemplate = path.join(outDir, `youtube_${Date.now()}.%(ext)s`);
<<<<<<< HEAD
  const args = [
    url,
    "--format", "18/best",
    "--output", outTemplate,
    "--no-playlist",
    "--quiet",
    "--socket-timeout", "30",
    "--retries", "3",
  ];

  const result = spawnSync(ytDlp, args, { encoding: "utf8", timeout: 300000 });

  if (result.status !== 0) {
    throw new Error(`yt-dlp failed: ${result.stderr?.trim() || result.error?.message}`);
  }

  const files = fs.readdirSync(outDir)
    .map(f => path.join(outDir, f))
    .filter(f => f.includes("youtube_"));

  return files[0];
}

function normalizeTranscript(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.transcript)) return data.transcript;
  if (Array.isArray(data?.segments)) return data.segments;
  if (typeof data?.text === "string" && data.text.trim()) {
    return [{ start: 0, end: 0, text: data.text.trim() }];
  }
  return [];
=======

  // Download best audio only — sufficient for transcription, much smaller than video
  const args = [
    url,
    "--format", "bestaudio/best",
    "--output", outTemplate,
    "--no-playlist",
    "--no-warnings",
    "--no-update",
    "--quiet",
  ];

  log("yt-dlp args:", args.join(" "));

  const result = spawnSync(ytDlp, args, { encoding: "utf8", timeout: 300000 });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || result.error?.message || "unknown error";
    throw new Error(`yt-dlp failed: ${stderr}`);
  }

  // Find the downloaded file (extension varies: webm, m4a, opus, mp3…)
  const files = fs.readdirSync(outDir)
    .map((f) => path.join(outDir, f))
    .filter((f) => f.includes("youtube_") && fs.statSync(f).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (!files.length) throw new Error("yt-dlp ran but no output file found");

  log("YouTube saved:", files[0]);
  return files[0];
>>>>>>> main
}

exports.transcribe = async (filePath) => {
  log("Transcribing:", filePath);

  if (groqClient) {
    const whisperFile = prepareWhisperFile(filePath);
    try {
      const transcription = await groqClient.audio.transcriptions.create({
        file: fs.createReadStream(whisperFile.filePath),
        model: "whisper-large-v3-turbo",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });
      return normalizeTranscript(transcription);
    } catch (err) {
<<<<<<< HEAD
      errLog("Groq Whisper failed:", err.message);
    } finally {
      if (whisperFile.cleanupPath) {
        fs.rmSync(whisperFile.cleanupPath, { force: true });
      }
=======
      errLog("FastAPI transcribe failed, falling back to local:", err.message, err.code || "", err.response?.data?.detail || "");
>>>>>>> main
    }
  }

  if (TRANSCRIBE_URL) {
    try {
      const data = await sendFileToService(TRANSCRIBE_URL, filePath);
      return normalizeTranscript(data);
    } catch (err) {
      errLog("FastAPI transcribe failed:", err.message);
    }
  }

  return [];
};

exports.extract = async (filePath) => {
  log("Extracting frames:", filePath);

  if (EXTRACT_URL) {
    try {
      const data = await sendFileToService(EXTRACT_URL, filePath);
      return Array.isArray(data) ? data : data.frames || [];
    } catch (err) {
      errLog("FastAPI extract failed:", err.message);
    }
  }

  return [];
};

exports.ingestLectureText = async (lectureId, text) => {
  if (!text?.trim()) return false;
  try {
    await axios.post(`${PYTHON_AI_URL}/ingest-text`, {
      document_id: `lecture_${lectureId}`,
      text,
    });
    return true;
  } catch {
    return false;
  }
};

<<<<<<< HEAD
=======
/* ===========================================================
   Vector store helpers
   =========================================================== */
>>>>>>> main
async function queryVectors(documentId, query, topK = 5) {
  try {
    const resp = await axios.post(
      `${PYTHON_AI_URL}/query-document`,
      { document_id: documentId, query, top_k: topK },
      { timeout: 15000 }
    );
    return resp.data.chunks || [];
  } catch (err) {
<<<<<<< HEAD
    errLog(`Vector query failed for ${documentId}:`, axiosErrorDetail(err));
=======
    errLog(`Vector query failed for ${documentId}:`, err.message);
>>>>>>> main
    return [];
  }
}

<<<<<<< HEAD
exports.dualSummarize = async (cleanText, { lectureId, bookDocumentIds = [] } = {}) => {
  log("Summarizing, text length:", cleanText?.length || 0);
  let localSummary = "";
  let aiSummary = "";
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
    const unique = allChunks.filter((c) => {
      const key = `${c.chunk_index ?? c.text?.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length > 0) {
      semanticContext = unique.map((c, i) => `[Section ${i + 1}]\n${c.text}`).join("\n\n");
      log(`Summary semantic context: ${unique.length} chunks`);
    }
  }

  if (!semanticContext && SUMMARIZE_URL) {
    try {
      const res = await axios.post(SUMMARIZE_URL, { text: cleanText }, { timeout: 120000 });
      localSummary = res.data?.summary || "";
    } catch (err) {
      errLog("FastAPI summarize failed:", err.message);
    }
  }

  try {
    const content = semanticContext || cleanText;
    const systemPrompt = semanticContext
      ? "You are an expert educational AI. Generate a clear lecture summary with sections: Overview, Key Concepts, Important Details, Takeaways."
      : "You are a helpful summarization assistant for lecture notes. Provide a clear, structured summary with key points and takeaways.";
    aiSummary = await geminiChat(systemPrompt, content, { maxTokens: 4096, temperature: 0.3 });
  } catch (err) {
    errLog("LLM summarize failed:", err.message);
  }

  return { localSummary, aiSummary };
};

exports.generateQuiz = async (text, numQuestions = 5, { lectureId, bookDocumentIds = [] } = {}) => {
  log("Generating quiz, text length:", text?.length || 0);
=======
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
   Dual Quiz Generator (Local + OpenAI structured JSON)
   =========================================================== */
exports.generateQuiz = async (text, numQuestions = 5, { lectureId, bookDocumentIds = [] } = {}) => {
  log(`Generating quiz, text length: ${text?.length || 0}`);
>>>>>>> main
  let localQuiz = [];
  let aiQuiz = [];
  let aiQuizStructured = [];
  let semanticContext = "";

  if (lectureId) {
    const allChunks = [];
    allChunks.push(...await queryVectors(`lecture_${lectureId}`, "key concepts definitions examples", 6));
    for (const bookId of bookDocumentIds) {
      allChunks.push(...await queryVectors(bookId, "key concepts definitions", 3));
    }
    if (allChunks.length > 0) {
      semanticContext = allChunks.map((c, i) => `[Section ${i + 1}]\n${c.text}`).join("\n\n");
    }
  }

  const quizContent = semanticContext || text;

<<<<<<< HEAD
  if (QUIZ_URL) {
    try {
      const res = await axios.post(
        QUIZ_URL,
        { text: quizContent, num_questions: numQuestions },
        { timeout: 300000 }
      );
      if (Array.isArray(res.data?.structured)) {
        aiQuizStructured = res.data.structured;
      }
      if (Array.isArray(res.data?.questions)) {
        localQuiz = res.data.questions.map((q) => typeof q === "string" ? q : q.question || JSON.stringify(q));
=======
  // ── Semantic context from ChromaDB ──
  let semanticContext = "";
  if (lectureId) {
    const allChunks = [];
    const lectureChunks = await queryVectors(`lecture_${lectureId}`, "key concepts definitions examples", 6);
    allChunks.push(...lectureChunks);
    for (const bookId of bookDocumentIds) {
      const bookChunks = await queryVectors(bookId, "key concepts definitions", 3);
      allChunks.push(...bookChunks);
    }
    if (allChunks.length > 0) {
      semanticContext = allChunks.map((c, i) => `[Section ${i + 1}]\n${c.text}`).join("\n\n");
      log(`Quiz semantic context: ${allChunks.length} chunks`);
    }
  }

  const quizContent = semanticContext || text;

  // Local quiz via FastAPI or spawnSync
  let localQuizStructured = [];
  if (QUIZ_URL) {
    try {
      const data = await axios.post(QUIZ_URL, { text: quizContent, num_questions: numQuestions }, { timeout: 120000 });
      const result = data.data;
      // Use new structured MCQ format from Flan-T5 when available
      if (result.structured && Array.isArray(result.structured)) {
        localQuizStructured = result.structured;
        log("Quiz via FastAPI (structured):", localQuizStructured.length, "MCQs");
      }
      if (result.questions) {
        localQuiz = result.questions.map(q => typeof q === 'string' ? q : q.question || JSON.stringify(q));
>>>>>>> main
      }
    } catch (err) {
<<<<<<< HEAD
      errLog("FastAPI quiz failed:", err.message);
    }
  }

  try {
    const systemPrompt = `You are an educational AI. Generate multiple-choice quizzes as JSON.
Return ONLY: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0}]}
correctAnswer is a 0-based index. Generate exactly ${numQuestions} questions.`;
    const parsed = await geminiJSON(systemPrompt, `Generate ${numQuestions} MCQs from:\n${quizContent}`);

    if (Array.isArray(parsed.questions)) {
      aiQuizStructured = parsed.questions;
      const letters = ["A", "B", "C", "D"];
      aiQuiz = parsed.questions.map((q, i) => {
        const opts = (q.options || []).map((o, j) => `${letters[j]}) ${o}`).join("\n");
        return `Q${i + 1}. ${q.question}\n${opts}\nAnswer: ${letters[q.correctAnswer] || "A"}`;
      });
    }
  } catch (err) {
    errLog("LLM quiz failed:", err.message);
=======
      errLog("FastAPI quiz failed (skipping local fallback, relying on OpenAI):", err.message);
    }
  } else {
    // Local quiz only when FastAPI is not configured
    const quizTmp = path.join(os.tmpdir(), `lns_quiz_${Date.now()}.txt`);
    try {
      fs.writeFileSync(quizTmp, text, "utf8");
      const pyRes = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "quiz_generator.py"), quizTmp], { encoding: "utf8" });
      if (pyRes.status !== 0) errLog("quiz_generator.py stderr:", pyRes.stderr);
      const output = pyRes.stdout?.toString().trim();
      if (output) {
        localQuiz = output.includes("\n") ? output.split("\n").filter((l) => l.trim()) : [output];
      }
    } catch (err) {
      errLog("Local quiz failed:", err.message);
    } finally {
      fs.rmSync(quizTmp, { force: true });
    }
  }

  // Gemini quiz — structured JSON output
  try {
    if (process.env.GEMINI_API_KEY) {
      log("Calling Gemini 2.0 Flash for structured quiz...");

      const systemPrompt = `You are an educational AI. Generate multiple-choice quizzes as JSON.
Return ONLY a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "the question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswer": 0
    }
  ]
}
correctAnswer is the 0-based index of the correct option. Generate exactly ${numQuestions} questions.
Make questions educational, clear, and test understanding — not just recall.
Each option should be plausible. Avoid "All of the above" or "None of the above".`;

      const parsed = await geminiJSON(
        systemPrompt,
        `Generate ${numQuestions} MCQs from this lecture content:\n${quizContent}`
      );

      if (parsed.questions && Array.isArray(parsed.questions)) {
        aiQuizStructured = parsed.questions;
        const letters = ["A", "B", "C", "D"];
        aiQuiz = parsed.questions.map((q, i) => {
          const opts = q.options.map((o, j) => `${letters[j]}) ${o}`).join("\n");
          return `Q${i + 1}. ${q.question}\n${opts}\nAnswer: ${letters[q.correctAnswer] || "A"}`;
        });
      }
      log("Gemini structured quiz:", aiQuizStructured.length, "questions");
    }
  } catch (err) {
    errLog("Gemini quiz failed:", err.message);
>>>>>>> main
  }

  // Use OpenAI structured quiz if available, otherwise fall back to Flan-T5 structured
  const finalStructured = aiQuizStructured.length > 0 ? aiQuizStructured : localQuizStructured;

  return {
    localQuiz,
    aiQuiz,
    mergedQuiz: [...localQuiz, "---", ...aiQuiz],
    aiQuizStructured: finalStructured,
  };
};

<<<<<<< HEAD
=======
/* ===========================================================
   Dual Summarization (Local + OpenAI)
   =========================================================== */
exports.dualSummarize = async (cleanText, { lectureId, bookDocumentIds = [] } = {}) => {
  log("Summarizing, text length:", cleanText?.length || 0);
  let localSummary = "";
  let aiSummary = "";

  // ── Semantic retrieval from ChromaDB ──
  let semanticContext = "";
  if (lectureId) {
    const allChunks = [];
    const queries = ["main topics and key concepts", "important definitions and explanations", "examples and applications"];
    for (const q of queries) {
      const chunks = await queryVectors(`lecture_${lectureId}`, q, 4);
      allChunks.push(...chunks);
    }
    for (const bookId of bookDocumentIds) {
      const chunks = await queryVectors(bookId, "relevant theory and concepts", 3);
      allChunks.push(...chunks);
    }
    // Deduplicate by chunk_index
    const seen = new Set();
    const unique = allChunks.filter((c) => {
      const key = `${c.chunk_index ?? c.text?.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length > 0) {
      semanticContext = unique.map((c, i) => `[Section ${i + 1}]\n${c.text}`).join("\n\n");
      log(`Summary semantic context: ${unique.length} chunks (lecture + ${bookDocumentIds.length} books)`);
    }
  }

  // ── Local BART summarization (only when no semantic context available) ──
  if (!semanticContext) {
    if (SUMMARIZE_URL) {
      try {
        const res = await axios.post(SUMMARIZE_URL, { text: cleanText }, { timeout: 120000 });
        localSummary = res.data?.summary || "";
        log("FastAPI summary length:", localSummary.length);
      } catch (err) {
        errLog("FastAPI summarize failed (skipping local fallback, relying on OpenAI):", err.message);
      }
    } else {
      const cleanTmp = path.join(os.tmpdir(), `lns_clean_${Date.now()}.txt`);
      const summTmp = path.join(os.tmpdir(), `lns_summ_${Date.now()}.txt`);
      try {
        fs.writeFileSync(cleanTmp, cleanText, "utf8");
        const cleanRes = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "cleaner.py"), cleanTmp], { encoding: "utf8" });
        if (cleanRes.status !== 0) errLog("cleaner.py stderr:", cleanRes.stderr);
        const cleaned = cleanRes.stdout?.toString().trim() || cleanText;

        fs.writeFileSync(summTmp, cleaned, "utf8");
        const local = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "summarize.py"), summTmp], { encoding: "utf8" });
        if (local.status !== 0) errLog("summarize.py stderr:", local.stderr);
        localSummary = local.stdout?.toString().trim() || "";
        log("Local summary length:", localSummary.length);
      } catch (err) {
        errLog("Local summarize failed:", err.message);
      } finally {
        fs.rmSync(cleanTmp, { force: true });
        fs.rmSync(summTmp, { force: true });
      }
    }
  }

  // ── Gemini summarization — uses semantic context when available ──
  try {
    if (process.env.GEMINI_API_KEY) {
      log("Calling Gemini 2.0 Flash for summarization...");
      const contentToSummarize = semanticContext || cleanText;
      const hasBooks = bookDocumentIds?.length > 0;
      const systemPrompt = semanticContext
        ? `You are an expert educational AI. Generate a comprehensive, well-structured summary from the lecture content${hasBooks ? " and supplementary book material" : ""} provided below. Use this format:\n\n## Overview\nA brief 2-3 sentence overview of the lecture topic.\n\n## Key Concepts\nBulleted list of the most important concepts covered.\n\n## Important Details\nDetailed explanations of complex topics, formulas, or processes.\n\n## Takeaways\nWhat students should remember and be able to apply.\n\nBe concise, clear, and educational. Use simple language. Avoid filler words.`
        : "You are a helpful summarization assistant for lecture notes. Provide a clear, structured summary with key points and takeaways. Use markdown formatting with headers.";

      aiSummary = await geminiChat(systemPrompt, contentToSummarize, {
        maxTokens: 4096,
        temperature: 0.3,
      });
      log("Gemini summary length:", aiSummary.length);
    }
  } catch (err) {
    errLog("Gemini summarize failed:", err.message);
  }

  return { localSummary, aiSummary };
};

/* ===========================================================
   Prepare Inputs
   =========================================================== */
>>>>>>> main
exports.prepareInputs = async ({ videoPath, audioPath, pptPath, youtubeUrl, audioUrl, tmpDir }) => {
  log("Preparing inputs:", { videoPath, audioPath, pptPath, youtubeUrl, audioUrl });
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    if (videoPath && fs.existsSync(videoPath)) return { videoPath, cleanupPaths: [] };
    if (youtubeUrl) {
<<<<<<< HEAD
      const downloaded = await downloadYouTubeVideo(youtubeUrl, tmpDir);
      return { videoPath: downloaded, cleanupPaths: [downloaded] };
    }
    if (audioPath && fs.existsSync(audioPath)) return { audioPath, cleanupPaths: [] };
    if (audioUrl) {
      const downloaded = await downloadFileFromUrl(audioUrl, tmpDir, "audio");
      return { audioPath: downloaded, cleanupPaths: [downloaded] };
    }
    if (pptPath && fs.existsSync(pptPath)) return { pptPath, cleanupPaths: [] };

=======
      const downloadedVideoPath = await downloadYouTubeVideo(youtubeUrl, tmpDir);
      return { videoPath: downloadedVideoPath, cleanupPaths: [downloadedVideoPath] };
    }
    if (audioPath && fs.existsSync(audioPath)) return { audioPath, cleanupPaths: [] };
    if (audioUrl) {
      const downloadedAudioPath = await downloadFileFromUrl(audioUrl, tmpDir, "audio");
      return { audioPath: downloadedAudioPath, cleanupPaths: [downloadedAudioPath] };
    }
    if (pptPath && fs.existsSync(pptPath)) return { pptPath, cleanupPaths: [] };

    log("No valid input found");
>>>>>>> main
    return { cleanupPaths: [] };
  } catch (err) {
    errLog("prepareInputs failed:", err.message);
    return { cleanupPaths: [] };
  }
};
