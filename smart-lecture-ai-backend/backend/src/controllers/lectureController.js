const fs = require("fs");
const path = require("path");
const { Queue } = require("bullmq");
const Lecture = require("../models/Lecture");
const { connection, isRedisAvailable } = require("../queues");
const { processLectureJob } = require("../services/lectureProcessing");

let aiQueue = null;

function getQueue() {
  if (!isRedisAvailable()) {
    return null;
  }

  if (!aiQueue) {
    aiQueue = new Queue("ai-jobs", { connection });
  }

  return aiQueue;
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

function toWebUrl(filePath) {
  if (!filePath) return null;
  return `/${filePath.replace(/^[\\/]+/, "").replace(/\\/g, "/")}`;
}

function absPathFromUrl(url) {
  if (!url || isRemoteUrl(url)) return null;
  const relativePath = url.replace(/^\//, "");
  return path.resolve(__dirname, "../../", relativePath);
}

function hasLectureSource({ youtubeUrl, audioUrl, videoUrl, pptUrl }) {
  return Boolean(youtubeUrl || audioUrl || videoUrl || pptUrl);
}

function buildLectureJobPayload(lecture) {
  return {
    lectureId: lecture._id.toString(),
    videoPath: absPathFromUrl(lecture.videoUrl),
    audioPath: absPathFromUrl(lecture.audioUrl),
    pptPath: absPathFromUrl(lecture.pptUrl),
    youtubeUrl: lecture.youtubeUrl || "",
    audioUrl: isRemoteUrl(lecture.audioUrl) ? lecture.audioUrl : "",
  };
}

async function queueOrProcessLecture(lecture) {
  const jobPayload = buildLectureJobPayload(lecture);
  const queue = getQueue();

  if (queue) {
    await queue.add("processLecture", jobPayload);
    lecture.status = "queued";
    lecture.errorMessage = "";
    await lecture.save();

    return {
      lecture,
      processingMode: "queue",
      processingFailed: false,
      message: "Lecture uploaded and queued for AI processing.",
    };
  }

  try {
    const processedLecture = await processLectureJob(jobPayload);
    return {
      lecture: processedLecture,
      processingMode: "inline",
      processingFailed: false,
      message: "Lecture uploaded and processed inline.",
    };
  } catch (error) {
    const failedLecture = await Lecture.findById(lecture._id);
    return {
      lecture: failedLecture || lecture,
      processingMode: "inline",
      processingFailed: true,
      message: "Lecture uploaded, but processing failed.",
    };
  }
}

exports.uploadLecture = async (req, res) => {
  const { title, description = "", youtubeUrl = "", audioUrl = "" } = req.body;
  const teacher = req.user?._id;

  if (!title?.trim()) {
    return res.status(400).json({ error: "Title is required." });
  }

  const uploadsDir = path.join(__dirname, "../../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const videoUrl = req.files?.video?.[0]
    ? toWebUrl(`uploads/${req.files.video[0].filename}`)
    : null;
  const uploadedAudioUrl = req.files?.audio?.[0]
    ? toWebUrl(`uploads/${req.files.audio[0].filename}`)
    : null;
  const pptUrl = req.files?.ppt?.[0]
    ? toWebUrl(`uploads/${req.files.ppt[0].filename}`)
    : null;
  const normalizedYoutubeUrl = youtubeUrl.trim();
  const normalizedAudioUrl = uploadedAudioUrl || audioUrl.trim() || null;

  if (
    !hasLectureSource({
      youtubeUrl: normalizedYoutubeUrl,
      audioUrl: normalizedAudioUrl,
      videoUrl,
      pptUrl,
    })
  ) {
    return res.status(400).json({
      error: "Provide at least one lecture source: video, audio, slides, or a YouTube URL.",
    });
  }

  const lecture = await Lecture.create({
    title: title.trim(),
    description: description.trim(),
    teacher,
    youtubeUrl: normalizedYoutubeUrl || null,
    videoUrl,
    audioUrl: normalizedAudioUrl,
    pptUrl,
    status: "uploaded",
  });

  const result = await queueOrProcessLecture(lecture);

  return res.status(201).json(result);
};

exports.getLectures = async (req, res) => {
  const role = req.user?.role;
  const query = role === "teacher" ? { teacher: req.user._id } : {};
  const lectures = await Lecture.find(query).sort({ createdAt: -1 });
  res.json({ lectures });
};

exports.getLectureById = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id).populate("teacher", "name email");
  if (!lecture) {
    return res.status(404).json({ error: "Lecture not found" });
  }

  res.json(lecture);
};

exports.getLectureSummary = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "Lecture not found" });
  }

  res.json({
    summary: lecture.summary || {},
    status: lecture.status,
    errorMessage: lecture.errorMessage || "",
  });
};

exports.processLecture = async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "Lecture not found" });
  }

  if (
    !hasLectureSource({
      youtubeUrl: lecture.youtubeUrl,
      audioUrl: lecture.audioUrl,
      videoUrl: lecture.videoUrl,
      pptUrl: lecture.pptUrl,
    })
  ) {
    return res.status(400).json({
      error: "No valid lecture media is attached to this record.",
    });
  }

  const result = await queueOrProcessLecture(lecture);
  res.json(result);
};

module.exports = {
  ...module.exports,
  buildLectureJobPayload,
  hasLectureSource,
};
