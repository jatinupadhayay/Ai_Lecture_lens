const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { Worker } = require("bullmq");
const connectDB = require("./config/db");
const { connection } = require("./queues");

const { processLectureJob, markLectureFailed } = require("./services/lectureProcessing");

async function run() {
  await connectDB(process.env.MONGO_URI);
  console.log("MongoDB connected. Worker is ready to process AI jobs.");

  const worker = new Worker(
    "ai-jobs",
    async (job) => {
      const { lectureId } = job.data;
      console.log(`[worker] Processing lecture ${lectureId}`);
      await processLectureJob(job.data);
      console.log(`[worker] Lecture ${lectureId} completed.`);
      return { success: true };
    },
    {
      connection,
      lockDuration: 900000,    // 15 minutes — prevents lock expiry on long transcriptions
      lockRenewTime: 300000,   // renew every 5 minutes
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] Job ${job.id} completed successfully.`);
  });

  worker.on("failed", async (job, error) => {
    console.error(`[worker] Job ${job?.id} failed: ${error.message}`);
    await markLectureFailed(job?.data?.lectureId, error.message);
  });
}

run().catch((error) => {
  console.error("Worker crashed:", error);
  process.exit(1);
});

