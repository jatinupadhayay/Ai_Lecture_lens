require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { Worker } = require("bullmq");
const { connection } = require("./queues");
const connectDB = require("./config/db");
const Lecture = require("./models/Lecture");
const AIJob = require("./models/AIJob");
const aiService = require("./services/aiService");

async function run() {
  await connectDB(process.env.MONGO_URI);
  console.log("✅ MongoDB connected. Worker is ready to process AI jobs.");

  const worker = new Worker(
    "ai-jobs",
    async (job) => {
      const {
        lectureId,
        videoPath,
        audioPath,
        pptPath,
        youtubeUrl,
        audioUrl,
      } = job.data;

      console.log(`🎥 [Worker] Processing lecture: ${lectureId}`);
      const lecture = await Lecture.findById(lectureId);
      if (!lecture) throw new Error("Lecture not found");

      lecture.status = "processing";
      await lecture.save();

      const tmpDir = path.join(__dirname, "../../tmp");
      const prepared = await aiService.prepareInputs({
        videoPath,
        audioPath,
        pptPath,
        youtubeUrl,
        audioUrl,
        tmpDir,
      });

      const inputFile = prepared.videoPath || prepared.audioPath || prepared.pptPath;
      if (!inputFile) throw new Error("No valid input found for processing");

      // 1️⃣ Transcription
      console.log(`[Worker] 🧠 Transcribing: ${inputFile}`);
      const transcript = await aiService.transcribe(inputFile);
      lecture.transcript = transcript;
      await lecture.save();

      // 2️⃣ Slide or frame extraction
      console.log(`[Worker] 🖼 Extracting frames/slides...`);
      const extractRes = await aiService.extract(inputFile);
      lecture.frames = extractRes.frames || extractRes;
      await lecture.save();

      // 3️⃣ Dual summarization
      console.log(`[Worker] 🧩 Running summarization...`);
      const fullText = (lecture.transcript || []).map((s) => s.text).join(" ");
      const summaryRes = await aiService.dualSummarize(fullText);
      lecture.summary = {
        local: summaryRes.localSummary,
        ai: summaryRes.aiSummary,
        merged: `${summaryRes.localSummary}\n\n---\n\n${summaryRes.aiSummary}`,
      };

      // 4️⃣ Quiz generation
      console.log(`[Worker] 🎯 Generating quiz...`);
      const quizRes = await aiService.generateQuiz(fullText, 7);
      lecture.quiz = {
        local: quizRes.localQuiz || [],
        ai: quizRes.aiQuiz || [],
        merged: quizRes.mergedQuiz || [],
      };
      // Store structured quiz data if available from OpenAI
      if (quizRes.aiQuizStructured && quizRes.aiQuizStructured.length > 0) {
        lecture.quizStructured = quizRes.aiQuizStructured;
      }
      lecture.status = "completed";
      await lecture.save();

      // 5️⃣ Cleanup temp files (downloaded YT videos, etc.)
      const tmpDir = path.join(__dirname, "../../tmp");
      try {
        if (fs.existsSync(tmpDir)) {
          const tmpFiles = fs.readdirSync(tmpDir);
          for (const f of tmpFiles) {
            fs.unlinkSync(path.join(tmpDir, f));
          }
          console.log(`[Worker] 🧹 Cleaned ${tmpFiles.length} temp files.`);
        }
      } catch (cleanErr) {
        console.warn(`[Worker] ⚠️ Temp cleanup failed:`, cleanErr.message);
      }

      console.log(`✅ [Worker] Lecture ${lectureId} completed successfully.`);
      return { success: true };
    },
    { connection }
  );

  worker.on("completed", (job) =>
    console.log(`✅ Job ${job.id} completed successfully.`)
  );

  worker.on("failed", async (job, err) => {
    console.error(`❌ Job ${job?.id} failed: ${err.message}`);
    // Mark lecture as failed
    try {
      const lectureId = job?.data?.lectureId;
      if (lectureId) {
        await Lecture.findByIdAndUpdate(lectureId, { status: "failed" });
      }
    } catch (updateErr) {
      console.error("Failed to update lecture status:", updateErr.message);
    }
  });
}

run().catch((err) => {
  console.error("❌ Worker crashed:", err);
  process.exit(1);
});
