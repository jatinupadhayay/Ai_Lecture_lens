const fs = require("fs");
const path = require("path");
const Lecture = require("../models/Lecture");
const aiService = require("./aiService");

function textFromItems(items = []) {
  return items
    .map((item) => item?.text?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildLectureText(transcript = [], frames = []) {
  return textFromItems(transcript) || textFromItems(frames);
}

function buildMergedSummary(localSummary = "", aiSummary = "") {
  return [localSummary?.trim(), aiSummary?.trim()].filter(Boolean).join("\n\n---\n\n");
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanupFiles(pathsToDelete = []) {
  for (const filePath of pathsToDelete) {
    if (!filePath) continue;
    try {
      fs.rmSync(filePath, { force: true });
    } catch (error) {
      console.warn("[lectureProcessing] Cleanup failed for", filePath, error.message);
    }
  }
}

async function markLectureFailed(lectureId, message) {
  if (!lectureId) return;

  try {
    await Lecture.findByIdAndUpdate(lectureId, {
      status: "failed",
      errorMessage: message || "Lecture processing failed.",
    });
  } catch (error) {
    console.error("[lectureProcessing] Failed to update lecture status:", error.message);
  }
}

async function processLectureJob({
  lectureId,
  videoPath,
  audioPath,
  pptPath,
  youtubeUrl,
  audioUrl,
}) {
  let lecture = null;
  let cleanupPaths = [];

  try {
    lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      throw new Error("Lecture not found");
    }

    lecture.status = "processing";
    lecture.errorMessage = "";
    await lecture.save();

    const tmpDir = path.join(__dirname, "../../tmp", lectureId.toString());
    const prepared = await aiService.prepareInputs({
      videoPath,
      audioPath,
      pptPath,
      youtubeUrl,
      audioUrl,
      tmpDir,
    });

    cleanupPaths = prepared.cleanupPaths || [];

    const inputFile = prepared.videoPath || prepared.audioPath || prepared.pptPath;
    if (!inputFile) {
      throw new Error("No valid lecture media was provided for processing.");
    }

    const transcript = await aiService.transcribe(inputFile);
    const extractResult = await aiService.extract(inputFile);
    const frames = Array.isArray(extractResult)
      ? extractResult
      : extractResult?.frames || [];

    const lectureText = buildLectureText(transcript, frames);
    if (!lectureText) {
      throw new Error("Processing finished without extractable lecture text.");
    }

    const summaryResult = await aiService.dualSummarize(lectureText);
    const localSummary = summaryResult.localSummary || "";
    const aiSummary = summaryResult.aiSummary || "";
    const mergedSummary = buildMergedSummary(localSummary, aiSummary);

    if (!mergedSummary) {
      throw new Error("Summary generation completed without usable output.");
    }

    const quizResult = await aiService.generateQuiz(lectureText, 7);

    lecture.transcript = Array.isArray(transcript) ? transcript : [];
    lecture.frames = frames;
    lecture.summary = {
      local: localSummary,
      ai: aiSummary,
      merged: mergedSummary,
    };
    lecture.quiz = {
      local: normalizeStringArray(quizResult.localQuiz),
      ai: normalizeStringArray(quizResult.aiQuiz),
      merged: normalizeStringArray(quizResult.mergedQuiz),
    };
    lecture.quizStructured = Array.isArray(quizResult.aiQuizStructured)
      ? quizResult.aiQuizStructured
      : [];
    lecture.status = "completed";
    lecture.errorMessage = "";
    await lecture.save();

    return lecture;
  } catch (error) {
    await markLectureFailed(lectureId, error.message);
    throw error;
  } finally {
    cleanupFiles(cleanupPaths);
  }
}

module.exports = {
  buildLectureText,
  buildMergedSummary,
  processLectureJob,
  markLectureFailed,
};
