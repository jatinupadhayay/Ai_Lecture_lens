require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { spawnSync, execFileSync } = require("child_process");
const FormData = require("form-data");
const Groq = require("groq-sdk");
const { geminiChat, geminiJSON } = require("./gemini");

=======
const Groq = require("groq-sdk");
const { geminiChat, geminiJSON } = require("./gemini");

// ── Python / FastAPI config ──
const PYTHON_VENV_PATH = process.env.PYTHON_PATH || "python";
const AI_MODELS_DIR = path.join(__dirname, "../ ai_models");
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";
// FastAPI service URLs (preferred)
const TRANSCRIBE_URL = process.env.TRANSCRIBE_SERVICE_URL || null;
const EXTRACT_URL = process.env.EXTRACT_SERVICE_URL || null;
const QUIZ_URL = process.env.QUIZ_SERVICE_URL || null;
const SUMMARIZE_URL = process.env.SUMMARIZE_SERVICE_URL || null;
const CLEAN_URL = process.env.CLEAN_SERVICE_URL
  || (SUMMARIZE_URL ? SUMMARIZE_URL.replace("/summarize", "/clean") : null);

const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
// ── Groq client (for Whisper + LLM fallback) ──
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

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
  throw new Error("yt-dlp not found. Install it: https://github.com/yt-dlp/yt-dlp#installation");
  throw new Error("yt-dlp not found. Install: https://github.com/yt-dlp/yt-dlp#installation");
}

async function downloadYouTubeVideo(url, outDir) {
  log("Downloading YouTube via yt-dlp:", url);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ytDlp = findYtDlp();
  const outTemplate = path.join(outDir, `youtube_${Date.now()}.%(ext)s`);
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
      errLog("Groq Whisper failed:", err.message);
    } finally {
      if (whisperFile.cleanupPath) {
        fs.rmSync(whisperFile.cleanupPath, { force: true });
      }
    }
  }

  if (TRANSCRIBE_URL) {
    try {
      const data = await sendFileToService(TRANSCRIBE_URL, filePath);
      return normalizeTranscript(data);
    } catch (err) {
      errLog("FastAPI transcribe failed:", err.message);
    }
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

async function queryVectors(documentId, query, topK = 5) {
  try {
    const resp = await axios.post(
      `${PYTHON_AI_URL}/query-document`,
      { document_id: documentId, query, top_k: topK },
      { timeout: 15000 }
    );
    return resp.data.chunks || [];
  } catch (err) {
    errLog(`Vector query failed for ${documentId}:`, axiosErrorDetail(err));
    return [];
  }
}

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
      // Use new structured MCQ format from Flan-T5 when available
      if (result.structured && Array.isArray(result.structured)) {
        localQuizStructured = result.structured;
        log("Quiz via FastAPI (structured):", localQuizStructured.length, "MCQs");
      }
      if (result.questions) {
        localQuiz = result.questions.map(q => typeof q === 'string' ? q : q.question || JSON.stringify(q));
      }
    } catch (err) {
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
