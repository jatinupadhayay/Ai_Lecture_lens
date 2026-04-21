const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { Worker } = require("bullmq");
const { connection } = require("./queues");
const connectDB = require("./config/db");
const { processLectureJob, markLectureFailed } = require("./services/lectureProcessing");

async function run() {
  await connectDB(process.env.MONGO_URI);
  console.log("MongoDB connected. Worker is ready to process AI jobs.");

  const worker = new Worker(
    "ai-jobs",
    async (job) => {
      const { lectureId, videoPath, audioPath, pptPath, youtubeUrl, audioUrl } = job.data;

      console.log(`[Worker] Processing lecture: ${lectureId}`);
      await processLectureJob({
        lectureId,
        videoPath,
        audioPath,
        pptPath,
        youtubeUrl,
        audioUrl,
      });
      console.log(`[Worker] Lecture ${lectureId} completed successfully.`);

      return { success: true };
    },
    { connection }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed successfully.`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`Job ${job?.id} failed: ${err.message}`);
    await markLectureFailed(job?.data?.lectureId, err.message);
  });
}

run().catch((err) => {
  console.error("Worker crashed:", err);
  process.exit(1);
});
