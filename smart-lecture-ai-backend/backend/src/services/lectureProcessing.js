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
  videoUrl,
  audioPath,
  audioUrl,
  pptPath,
  pptUrl,
  youtubeUrl,
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

    let transcript = null;
    let frames = [];

    // For YouTube URLs, try caption/transcript API first (avoids video download + IP blocks)
    if (youtubeUrl) {
      try {
        console.log("[lectureProcessing] Trying YouTube caption API for:", youtubeUrl);
        transcript = await aiService.fetchYouTubeTranscript(youtubeUrl);
        console.log("[lectureProcessing] Caption API succeeded, segments:", transcript.length);
      } catch (captionErr) {
        console.warn("[lectureProcessing] Caption API failed, falling back to yt-dlp:", captionErr.message);
        transcript = null;
      }
    }

    // Fall back to file download + transcription if captions unavailable
    if (!transcript) {
      const tmpDir = path.join(__dirname, "../../tmp", lectureId.toString());
      const prepared = await aiService.prepareInputs({
        videoPath,
        videoUrl,
        audioPath,
        audioUrl,
        pptPath,
        pptUrl,
        youtubeUrl,
        tmpDir,
      });

      cleanupPaths = prepared.cleanupPaths || [];

      const inputFile = prepared.videoPath || prepared.audioPath || prepared.pptPath;
      if (!inputFile) {
        throw new Error(
          youtubeUrl
            ? "YouTube download failed — yt-dlp could not download the video and no captions were found. Check server logs."
            : "No valid lecture media was provided for processing."
        );
      }

      const [fetchedTranscript, extractResult] = await Promise.all([
        aiService.transcribe(inputFile),
        aiService.extract(inputFile),
      ]);
      transcript = fetchedTranscript;
      frames = Array.isArray(extractResult) ? extractResult : extractResult?.frames || [];
    }

    const lectureText = buildLectureText(transcript, frames);
    if (!lectureText) {
      throw new Error("Processing finished without extractable lecture text.");
    }

    // Ingest lecture transcript into ChromaDB for semantic retrieval
    const lectureIdStr = lectureId.toString();
    const ingested = await aiService.ingestLectureText(lectureIdStr, lectureText);
    console.log(`[lectureProcessing] Transcript ingested into vector store: ${ingested}`);

    // Clean + extract key content — used as fallback when vector store unavailable
    const preparedText = await aiService.prepareText(lectureText);

    const bookDocumentIds = (lecture.bookDocumentIds || []).map((id) => id.toString());
    const semanticOpts = { lectureId: lectureIdStr, bookDocumentIds };

    const [summaryResult, quizResult] = await Promise.all([
      aiService.dualSummarize(preparedText, semanticOpts),
      aiService.generateQuiz(preparedText, 7, semanticOpts),
    ]);
    const localSummary = summaryResult.localSummary || "";
    const aiSummary = summaryResult.aiSummary || "";
    const mergedSummary = buildMergedSummary(localSummary, aiSummary);

    if (!mergedSummary) {
      console.warn("[lectureProcessing] Summary is empty — continuing without summary.");
    }

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
