require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { spawnSync } = require("child_process");
const ytdl = require("@distube/ytdl-core");
const OpenAI = require("openai");
const FormData = require("form-data");

// Python paths — used as fallback when FastAPI is unavailable
const PYTHON_VENV_PATH = process.env.PYTHON_PATH || "python";
const AI_MODELS_DIR = path.join(__dirname, "../ai_models");

// FastAPI service URLs (preferred)
const TRANSCRIBE_URL = process.env.TRANSCRIBE_SERVICE_URL || null;
const EXTRACT_URL = process.env.EXTRACT_SERVICE_URL || null;
const QUIZ_URL = process.env.QUIZ_SERVICE_URL || null;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const log = (...msg) => console.log("[aiService]", ...msg);
const errLog = (...msg) => console.error("[aiService]", ...msg);

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

  const filePath = path.join(outDir, `youtube_${Date.now()}.mp4`);
  const stream = ytdl(url, { quality: "highestvideo", filter: "audioandvideo" });
  const writeStream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    stream.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
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
   Dual Quiz Generator (Local + OpenAI structured JSON)
   =========================================================== */
exports.generateQuiz = async (text, numQuestions = 5) => {
  log(`Generating quiz, text length: ${text?.length || 0}`);
  let localQuiz = [];
  let aiQuiz = [];
  let aiQuizStructured = [];

  // Local quiz via FastAPI or spawnSync
  if (QUIZ_URL) {
    try {
      const data = await axios.post(QUIZ_URL, { text, num_questions: numQuestions }, { timeout: 120000 });
      const result = data.data;
      if (result.questions) {
        localQuiz = result.questions.map(q => typeof q === 'string' ? q : q.question || JSON.stringify(q));
      }
      log("Quiz via FastAPI:", localQuiz.length, "questions");
    } catch (err) {
      errLog("FastAPI quiz failed, falling back to local:", err.message);
    }
  }

  if (localQuiz.length === 0) {
    try {
      const pyRes = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "quiz_generator.py"), text], { encoding: "utf8" });
      const output = pyRes.stdout?.toString().trim();
      if (output) {
        localQuiz = output.includes("\n") ? output.split("\n").filter((l) => l.trim()) : [output];
      }
    } catch (err) {
      errLog("Local quiz failed:", err.message);
    }
  }

  // OpenAI quiz — structured JSON output
  try {
    if (process.env.OPENAI_API_KEY) {
      log("Calling OpenAI for structured quiz...");
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an educational AI. Generate multiple-choice quizzes as JSON.
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
correctAnswer is the 0-based index of the correct option. Generate exactly ${numQuestions} questions.`,
          },
          { role: "user", content: `Generate ${numQuestions} MCQs from this lecture content:\n${text.slice(0, 5000)}` },
        ],
      });
      const raw = completion.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        aiQuizStructured = parsed.questions;
        const letters = ["A", "B", "C", "D"];
        aiQuiz = parsed.questions.map((q, i) => {
          const opts = q.options.map((o, j) => `${letters[j]}) ${o}`).join("\n");
          return `Q${i + 1}. ${q.question}\n${opts}\nAnswer: ${letters[q.correctAnswer] || "A"}`;
        });
      }
      log("OpenAI structured quiz:", aiQuizStructured.length, "questions");
    }
  } catch (err) {
    errLog("OpenAI quiz failed:", err.message);
  }

  return {
    localQuiz,
    aiQuiz,
    mergedQuiz: [...localQuiz, "---", ...aiQuiz],
    aiQuizStructured,
  };
};

/* ===========================================================
   Dual Summarization (Local + OpenAI)
   =========================================================== */
exports.dualSummarize = async (cleanText) => {
  log("Summarizing, text length:", cleanText?.length || 0);
  let localSummary = "";
  let aiSummary = "";

  // Local summarization
  try {
    const cleanRes = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "cleaner.py"), cleanText], { encoding: "utf8" });
    const cleaned = cleanRes.stdout?.toString() || cleanText;

    const local = spawnSync(PYTHON_VENV_PATH, [path.join(AI_MODELS_DIR, "summarize.py"), cleaned], { encoding: "utf8" });
    localSummary = local.stdout?.toString().trim() || "";
    log("Local summary length:", localSummary.length);
  } catch (err) {
    errLog("Local summarize failed:", err.message);
  }

  // OpenAI summarization
  try {
    if (process.env.OPENAI_API_KEY) {
      log("Calling OpenAI for summarization...");
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful summarization assistant for lecture notes. Provide a clear, structured summary with key points and takeaways." },
          { role: "user", content: cleanText.slice(0, 8000) },
        ],
      });
      aiSummary = resp.choices?.[0]?.message?.content || "";
      log("OpenAI summary length:", aiSummary.length);
    }
  } catch (err) {
    errLog("OpenAI summarize failed:", err.message);
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

    if (videoPath && fs.existsSync(videoPath)) return { videoPath };
    if (youtubeUrl) return { videoPath: await downloadYouTubeVideo(youtubeUrl, tmpDir) };
    if (audioPath && fs.existsSync(audioPath)) return { audioPath };
    if (audioUrl) return { audioPath: await downloadFileFromUrl(audioUrl, tmpDir, "audio") };
    if (pptPath && fs.existsSync(pptPath)) return { pptPath };

    log("No valid input found");
    return {};
  } catch (err) {
    errLog("prepareInputs failed:", err.message);
    return {};
  }
};
