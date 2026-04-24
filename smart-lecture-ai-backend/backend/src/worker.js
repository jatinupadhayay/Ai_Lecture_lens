<<<<<<< HEAD
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

=======
require("dotenv").config();
>>>>>>> main
const { Worker } = require("bullmq");
const connectDB = require("./config/db");
<<<<<<< HEAD
=======
const { connection } = require("./queues");
>>>>>>> main
const { processLectureJob, markLectureFailed } = require("./services/lectureProcessing");

async function run() {
  await connectDB(process.env.MONGO_URI);
  console.log("MongoDB connected. Worker is ready to process AI jobs.");

  const worker = new Worker(
    "ai-jobs",
    async (job) => {
<<<<<<< HEAD
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
=======
      console.log(`[worker] Processing lecture ${job.data.lectureId}`);
      await processLectureJob(job.data);
      console.log(`[worker] Lecture ${job.data.lectureId} completed.`);
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
>>>>>>> main
  process.exit(1);
});
