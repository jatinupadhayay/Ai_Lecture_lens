require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { spawnSync } = require("child_process");
const ytdl = require("@distube/ytdl-core");
const FormData = require("form-data");
const { geminiChat, geminiJSON } = require("./gemini");

// Python paths — used as fallback when FastAPI is unavailable
const PYTHON_VENV_PATH = process.env.PYTHON_PATH || "python";
const AI_MODELS_DIR = path.join(__dirname, "../ai_models");

// FastAPI service base URL (for vector store + direct endpoints)
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

// FastAPI service URLs (preferred)
const TRANSCRIBE_URL = process.env.TRANSCRIBE_SERVICE_URL || null;
const EXTRACT_URL = process.env.EXTRACT_SERVICE_URL || null;
const QUIZ_URL = process.env.QUIZ_SERVICE_URL || null;
const SUMMARIZE_URL = process.env.SUMMARIZE_SERVICE_URL || null;
const CLEAN_URL = process.env.CLEAN_SERVICE_URL
  || (SUMMARIZE_URL ? SUMMARIZE_URL.replace("/summarize", "/clean") : null);

const log = (...msg) => console.log("[aiService]", ...msg);
const errLog = (...msg) => console.error("[aiService]", ...msg);

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
async function sendFileToService(url, filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), path.basename(filePath));
  const res = await axios.post(url, form, {
    headers: form.getHeaders(),
    timeout: 300000, // 5 min timeout for large files
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return res.data;
}

/* ===========================================================
   Download file from URL
   =========================================================== */
async function downloadFileFromUrl(fileUrl, outDir, prefix = "audio") {
  log("Downloading:", fileUrl);
  if (!fileUrl) throw new Error("No URL provided");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ext = path.extname(fileUrl).split("?")[0] || ".mp3";
  const filePath = path.join(outDir, `${prefix}_${Date.now()}${ext}`);
  const writer = fs.createWriteStream(filePath);

  const response = await axios({
    url: fileUrl,
    method: "GET",
    responseType: "stream",
    timeout: 60000,
  });

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  log("Download complete:", filePath);
  return filePath;
}

/* ===========================================================
   Download YouTube Video
   =========================================================== */
async function downloadYouTubeVideo(url, outDir) {
  log("Downloading YouTube:", url);
  if (!ytdl.validateURL(url)) throw new Error("Invalid YouTube URL");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Prefer audio-only (smaller, faster, sufficient for transcription)
  // Fall back to lowest combined format if audioonly unavailable
  const info = await ytdl.getInfo(url);
  const audioFormat = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
  const ext = audioFormat ? ".webm" : ".mp4";
  const filePath = path.join(outDir, `youtube_${Date.now()}${ext}`);

  const streamOpts = audioFormat
    ? { quality: "highestaudio", filter: "audioonly" }
    : { quality: "lowest", filter: "audioandvideo" };

  const stream = ytdl.downloadFromInfo(info, streamOpts);
  const writeStream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    stream.on("error", reject);
    writeStream.on("error", reject);
    stream.pipe(writeStream);
    writeStream.on("finish", resolve);
  });

  log("YouTube saved:", filePath);
  return filePath;
}

/* ===========================================================
   Transcription — FastAPI first, spawnSync fallback
   =========================================================== */
exports.transcribe = async (filePath) => {
  log("Transcribing:", filePath);

  // Try FastAPI service
  if (TRANSCRIBE_URL) {
    try {
      const data = await sendFileToService(TRANSCRIBE_URL, filePath);
      log("Transcription via FastAPI:", Array.isArray(data) ? data.length : "ok");
      return Array.isArray(data) ? data : data.transcript || [];
    } catch (err) {
      errLog("FastAPI transcribe failed, falling back to local:", err.message);
    }
  }

  // Fallback: local Python script
  try {
    const result = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "transcriber.py"), filePath], { encoding: "utf8" });
    if (result.error) throw new Error(result.error.message);
    return JSON.parse(result.stdout.toString().trim() || "[]");
  } catch (err) {
    errLog("Local transcribe failed:", err.message);
    return [];
  }
};

/* ===========================================================
   Frame / Slide Extraction — FastAPI first, spawnSync fallback
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
   Dual Quiz Generator (Local + OpenAI structured JSON)
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
      }
      log("Quiz via FastAPI:", localQuiz.length, "questions");
    } catch (err) {
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
exports.prepareInputs = async ({ videoPath, audioPath, pptPath, youtubeUrl, audioUrl, tmpDir }) => {
  log("Preparing inputs:", { videoPath, audioPath, pptPath, youtubeUrl, audioUrl });
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    if (videoPath && fs.existsSync(videoPath)) return { videoPath, cleanupPaths: [] };
    if (youtubeUrl) {
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
    return { cleanupPaths: [] };
  } catch (err) {
    errLog("prepareInputs failed:", err.message);
    return { cleanupPaths: [] };
  }
};
