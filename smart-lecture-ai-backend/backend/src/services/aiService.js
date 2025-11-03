require("dotenv").config(); // Load .env variables
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { spawnSync } = require("child_process");
const ytdl = require("@distube/ytdl-core");
const OpenAI = require("openai");

// Get Python path from .env or fallback to system python
const PYTHON_VENV_PATH = process.env.PYTHON_PATH || "python";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const log = (...msg) => console.log("[aiService]", ...msg);
const errLog = (...msg) => console.error("[aiService ❌]", ...msg);

/* ===========================================================
   🔹 Download file from URL
   =========================================================== */
async function downloadFileFromUrl(fileUrl, outDir, prefix = "audio") {
  log("⬇️ downloadFileFromUrl called with:", fileUrl);
  try {
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

    log("✅ Download complete:", filePath);
    return filePath;
  } catch (err) {
    errLog("downloadFileFromUrl failed:", err.message);
    throw err;
  }
}

/* ===========================================================
   🔹 Download YouTube Video
   =========================================================== */
async function downloadYouTubeVideo(url, outDir) {
  log("🎬 downloadYouTubeVideo called:", url);
  try {
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

    log("✅ YouTube video saved:", filePath);
    return filePath;
  } catch (err) {
    errLog("YouTube download failed:", err.message);
    throw err;
  }
}

/* ===========================================================
   🔹 Transcription
   =========================================================== */
exports.transcribe = async (filePath) => {
  log("🧠 Transcribing:", filePath);
  try {
    const result = spawnSync(PYTHON_VENV_PATH, ["transcriber.py", filePath], { encoding: "utf8" });

    if (result.error) throw new Error(result.error.message);
    if (result.stderr) log("⚠️ Transcriber stderr:", result.stderr);

    const output = result.stdout.toString().trim();
    log("📄 Transcription raw output length:", output.length);

    const parsed = JSON.parse(output || "[]");
    log("✅ Transcription parsed successfully:", parsed.length, "entries");
    return parsed;
  } catch (err) {
    errLog("transcribe failed:", err.message);
    return [];
  }
};

/* ===========================================================
   🔹 Frame / Slide Extraction
   =========================================================== */
exports.extract = async (filePath) => {
  log("🖼 Extracting frames from:", filePath);
  try {
    const result = spawnSync(PYTHON_VENV_PATH, ["extractor.py", filePath], { encoding: "utf8" });

    if (result.error) throw new Error(result.error.message);
    if (result.stderr) log("⚠️ Extractor stderr:", result.stderr);

    const output = result.stdout.toString().trim();
    log("📄 Extractor raw output length:", output.length);

    const parsed = JSON.parse(output || "[]");
    log("✅ Frame extraction parsed:", parsed.length, "frames");
    return parsed;
  } catch (err) {
    errLog("extract failed:", err.message);
    return [];
  }
};

/* ===========================================================
   🔹 Dual Quiz Generator (Local + OpenAI)
   =========================================================== */
exports.generateQuiz = async (text, numQuestions = 5) => {
  log(`🎯 generateQuiz called with text length: ${text?.length || 0}`);
  let localQuiz = [];
  let aiQuiz = [];

  // Local quiz generation
  try {
    const pyRes = spawnSync(PYTHON_VENV_PATH, ["quiz_generator.py", text], { encoding: "utf8" });
    if (pyRes.stderr) log("⚠️ quiz_generator stderr:", pyRes.stderr);
    const output = pyRes.stdout.toString().trim();
    log("📄 Local quiz output length:", output.length);

    if (output) {
      localQuiz = output.includes("\n")
        ? output.split("\n").filter((l) => l.trim())
        : [output];
      log("✅ Local quiz generated:", localQuiz.length, "questions");
    } else {
      log("⚠️ Local quiz empty output");
    }
  } catch (err) {
    errLog("Local quiz generation failed:", err.message);
  }

  // OpenAI quiz
  try {
    if (process.env.OPENAI_API_KEY) {
      log("🤖 Calling OpenAI for quiz generation...");
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an educational AI that generates quizzes." },
          { role: "user", content: `Create ${numQuestions} MCQs from this:\n${text.slice(0, 5000)}` },
        ],
      });
      const quizText = completion.choices?.[0]?.message?.content || "";
      aiQuiz = quizText.split("\n").filter((l) => l.trim());
      log("✅ OpenAI quiz generated:", aiQuiz.length, "lines");
    } else {
      log("⚠️ Skipping OpenAI quiz - no API key");
    }
  } catch (err) {
    errLog("OpenAI quiz generation failed:", err.message);
  }

  return { localQuiz, aiQuiz, mergedQuiz: [...localQuiz, "---", ...aiQuiz] };
};

/* ===========================================================
   🔹 Dual Summarization (Local + OpenAI)
   =========================================================== */
exports.dualSummarize = async (cleanText) => {
  log("🧩 dualSummarize called. Text length:", cleanText?.length || 0);
  try {
    // Clean text
    const cleanRes = spawnSync(PYTHON_VENV_PATH, ["cleaner.py", cleanText], { encoding: "utf8" });
    if (cleanRes.stderr) log("⚠️ cleaner stderr:", cleanRes.stderr);
    const cleaned = cleanRes.stdout.toString();
    log("✅ Text cleaned. Length:", cleaned.length);

    // Local summarizer
    const local = spawnSync(PYTHON_VENV_PATH, ["summarize.py", cleaned], { encoding: "utf8" });
    if (local.stderr) log("⚠️ summarizer stderr:", local.stderr);
    const localSummary = local.stdout.toString().trim();
    log("✅ Local summary generated. Length:", localSummary.length);

    // OpenAI summarization
    let aiSummary = "";
    if (process.env.OPENAI_API_KEY) {
      log("🤖 Calling OpenAI for summarization...");
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful summarization assistant for lecture notes." },
          { role: "user", content: cleaned.slice(0, 8000) },
        ],
      });
      aiSummary = resp.choices?.[0]?.message?.content || "";
      log("✅ OpenAI summary generated. Length:", aiSummary.length);
    } else {
      log("⚠️ Skipping OpenAI summary - no API key");
    }

    return { localSummary, aiSummary };
  } catch (err) {
    errLog("dualSummarize failed:", err.message);
    throw err;
  }
};

/* ===========================================================
   🔹 Prepare Inputs
   =========================================================== */
exports.prepareInputs = async ({ videoPath, audioPath, pptPath, youtubeUrl, audioUrl, tmpDir }) => {
  log("📦 prepareInputs called:", { videoPath, audioPath, pptPath, youtubeUrl, audioUrl });
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    if (videoPath && fs.existsSync(videoPath)) {
      log("🎞 Using local video file:", videoPath);
      return { videoPath };
    }
    if (youtubeUrl) {
      const ytPath = await downloadYouTubeVideo(youtubeUrl, tmpDir);
      return { videoPath: ytPath };
    }
    if (audioPath && fs.existsSync(audioPath)) {
      log("🎧 Using local audio file:", audioPath);
      return { audioPath };
    }
    if (audioUrl) {
      const audPath = await downloadFileFromUrl(audioUrl, tmpDir, "audio");
      return { audioPath: audPath };
    }
    if (pptPath && fs.existsSync(pptPath)) {
      log("📊 Using local PPT file:", pptPath);
      return { pptPath };
    }

    log("⚠️ No valid input found");
    return {};
  } catch (err) {
    errLog("prepareInputs failed:", err.message);
    return {};
  }
};
