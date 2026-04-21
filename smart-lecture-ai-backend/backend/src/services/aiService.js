require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { spawnSync, execFileSync } = require("child_process");
const FormData = require("form-data");
const Groq = require("groq-sdk");
const { geminiChat, geminiJSON } = require("./gemini");

const PYTHON_VENV_PATH = process.env.PYTHON_PATH || "python";
const AI_MODELS_DIR = path.join(__dirname, "../ai_models");
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";
const TRANSCRIBE_URL = process.env.TRANSCRIBE_SERVICE_URL || null;
const EXTRACT_URL = process.env.EXTRACT_SERVICE_URL || null;
const QUIZ_URL = process.env.QUIZ_SERVICE_URL || null;
const SUMMARIZE_URL = process.env.SUMMARIZE_SERVICE_URL || null;
const CLEAN_URL = process.env.CLEAN_SERVICE_URL
  || (SUMMARIZE_URL ? SUMMARIZE_URL.replace("/summarize", "/clean") : null);

const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const log = (...msg) => console.log("[aiService]", ...msg);
const errLog = (...msg) => console.error("[aiService]", ...msg);

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

exports.transcribe = async (filePath) => {
  log("Transcribing:", filePath);

  if (groqClient) {
    try {
      const transcription = await groqClient.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-large-v3-turbo",
      });
      return transcription.segments || [];
    } catch {}
  }

  if (TRANSCRIBE_URL) {
    try {
      return await sendFileToService(TRANSCRIBE_URL, filePath);
    } catch {}
  }

  return [];
};

exports.extract = async (filePath) => {
  log("Extracting frames:", filePath);

  if (EXTRACT_URL) {
    try {
      return await sendFileToService(EXTRACT_URL, filePath);
    } catch {}
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