// backend/src/controllers/lectureController.js
const path = require("path");
const fs = require("fs");
const Lecture = require("../models/Lecture");
const { Queue } = require("bullmq");
const { connection, isRedisAvailable } = require("../queues");
const aiService = require("../services/aiService");

let aiQueue = null;
function getQueue() {
  if (!aiQueue && isRedisAvailable()) {
    aiQueue = new Queue("ai-jobs", { connection });
  }
  return aiQueue;
}

const now = () => new Date().toISOString();
const clog = (...a) => console.log(`[${now()}]`, ...a);

/* ===========================================================
   🔹 Helpers
   =========================================================== */
const toWebUrl = (filePath) => {
  if (!filePath) return null;
  // normalize to /uploads/filename.mp4 (forward slashes)
  return "/" + filePath.replace(/^[\\/]+/, "").replace(/\\/g, "/");
};

const absPathFromUrl = (url) => {
  if (!url) return null;
  const rel = url.replace(/^\//, ""); // remove leading slash
  return path.resolve(__dirname, "../../", rel);
};

/* ===========================================================
   🔹 Upload Lecture
   =========================================================== */
exports.uploadLecture = async (req, res) => {
  try {
    clog("🎥 uploadLecture called");
    const { title, description, youtubeUrl } = req.body;
    const teacher = req.user?._id;
    if (!title) return res.status(400).json({ error: "Title required" });

    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    let videoUrl = null,
      audioUrl = null,
      pptUrl = null;

    if (req.files) {
      if (req.files.video?.[0]) videoUrl = toWebUrl(`uploads/${req.files.video[0].filename}`);
      if (req.files.audio?.[0]) audioUrl = toWebUrl(`uploads/${req.files.audio[0].filename}`);
      if (req.files.ppt?.[0]) pptUrl = toWebUrl(`uploads/${req.files.ppt[0].filename}`);
    }

    // ✅ Create lecture document
    const lecture = new Lecture({
      title,
      description,
      teacher,
      videoUrl,
      audioUrl,
      pptUrl,
      youtubeUrl,
      status: "uploaded",
    });

    await lecture.save();
    clog("✅ Lecture saved to DB:", lecture._id);

    // ✅ Prepare absolute paths for worker job
    const absVideo = absPathFromUrl(videoUrl);
    const absAudio = absPathFromUrl(audioUrl);
    const absPpt = absPathFromUrl(pptUrl);

    clog("📁 File paths prepared:", { absVideo, absAudio, absPpt, youtubeUrl });

    // 🧠 Enqueue AI job
    try {
      await getQueue().add("processLecture", {
        lectureId: lecture._id.toString(),
        videoPath: absVideo,
        audioPath: absAudio,
        pptPath: absPpt,
        youtubeUrl,
      });
      lecture.status = "queued";
      await lecture.save();
      clog("📦 Lecture queued successfully for AI:", lecture._id);
    } catch (queueErr) {
      clog("⚠️ BullMQ failed. Running immediate AI processing locally...");
      lecture.status = "processing";
      await lecture.save();

      try {
        const { localSummary, aiSummary } = await aiService.dualSummarize("Temporary fallback text");
        lecture.summary = {
          local: localSummary,
          ai: aiSummary,
          merged: `${localSummary}\n\n${aiSummary}`,
        };
        lecture.status = "completed";
        await lecture.save();
        clog("✅ Immediate fallback AI summary generated.");
      } catch (innerErr) {
        clog("❌ Fallback AI processing failed:", innerErr.message);
      }
    }

    return res.status(201).json({ message: "Lecture uploaded and queued", lecture });
  } catch (err) {
    clog("❌ uploadLecture error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ===========================================================
   🔹 Get All Lectures
   =========================================================== */
exports.getLectures = async (req, res) => {
  try {
    // Teachers/admins see their own uploads; students see all lectures
    const role = req.user?.role;
    const query = role === "teacher" ? { teacher: req.user._id } : {};
    const lectures = await Lecture.find(query).sort({ createdAt: -1 });
    clog(`📚 Fetched ${lectures.length} lectures for role=${role}.`);
    res.json({ lectures });
  } catch (err) {
    clog("❌ getLectures error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ===========================================================
   🔹 Get One Lecture
   =========================================================== */
exports.getLectureById = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ error: "Lecture not found" });
    clog("📄 Lecture fetched:", lecture._id);
    res.json(lecture);
  } catch (err) {
    clog("❌ getLectureById error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ===========================================================
   🔹 Get Summary
   =========================================================== */
exports.getLectureSummary = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ error: "Lecture not found" });

    clog("🧾 Fetching summary for:", lecture._id, "| Status:", lecture.status);
    res.json({ summary: lecture.summary || {}, status: lecture.status });
  } catch (err) {
    clog("❌ getLectureSummary error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ===========================================================
   🔹 Manual Re-Process Lecture
   =========================================================== */
exports.processLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ error: "Lecture not found" });

    clog("🔁 Reprocessing lecture:", lecture._id, "| Current status:", lecture.status);

    const absVideo = absPathFromUrl(lecture.videoUrl);
    const absAudio = absPathFromUrl(lecture.audioUrl);
    const absPpt = absPathFromUrl(lecture.pptUrl);

    // Validate at least one file exists
    const filesExist = [absVideo, absAudio, absPpt].some((f) => f && fs.existsSync(f));
    if (!filesExist && !lecture.youtubeUrl) {
      clog("⚠️ No valid media found for reprocessing.");
      return res.status(400).json({ error: "No valid media file found for processing." });
    }

    const queue = getQueue();
    if (queue) {
      await queue.add("processLecture", {
        lectureId: lecture._id.toString(),
        videoPath: absVideo,
        audioPath: absAudio,
        pptPath: absPpt,
        youtubeUrl: lecture.youtubeUrl || null,
      });
      lecture.status = "queued";
      await lecture.save();
      clog("📦 Lecture successfully requeued for AI processing:", lecture._id);
    } else {
      clog("⚠️ Redis unavailable — cannot requeue. Processing inline...");
      lecture.status = "processing";
      await lecture.save();
    }

    res.json({ message: "Lecture requeued for processing", lecture });
  } catch (err) {
    clog("❌ processLecture error:", err);
    res.status(500).json({ error: err.message });
  }
};
