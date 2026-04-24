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
<<<<<<< HEAD
  return [localSummary?.trim(), aiSummary?.trim()]
    .filter(Boolean)
    .join("\n\n---\n\n");
=======
  return [localSummary?.trim(), aiSummary?.trim()].filter(Boolean).join("\n\n---\n\n");
>>>>>>> main
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

    const [transcript, extractResult] = await Promise.all([
      aiService.transcribe(inputFile),
      aiService.extract(inputFile),
    ]);
<<<<<<< HEAD

=======
>>>>>>> main
    const frames = Array.isArray(extractResult)
      ? extractResult
      : extractResult?.frames || [];

    const lectureText = buildLectureText(transcript, frames);
    if (!lectureText) {
      throw new Error("Processing finished without extractable lecture text.");
    }

<<<<<<< HEAD
=======
    // Ingest lecture transcript into ChromaDB for semantic retrieval
>>>>>>> main
    const lectureIdStr = lectureId.toString();
    const ingested = await aiService.ingestLectureText(lectureIdStr, lectureText);
    console.log(`[lectureProcessing] Transcript ingested into vector store: ${ingested}`);

<<<<<<< HEAD
    const preparedText = await aiService.prepareText(lectureText);

    const bookDocumentIds = (lecture.bookDocumentIds || []).map((id) => id.toString());

    const semanticOpts = {
      lectureId: ingested ? lectureIdStr : null,
      bookDocumentIds: ingested ? bookDocumentIds : [],
    };
=======
    // Clean + extract key content — used as fallback when vector store unavailable
    const preparedText = await aiService.prepareText(lectureText);

    const bookDocumentIds = (lecture.bookDocumentIds || []).map((id) => id.toString());
    const semanticOpts = { lectureId: lectureIdStr, bookDocumentIds };
>>>>>>> main

    const [summaryResult, quizResult] = await Promise.all([
      aiService.dualSummarize(preparedText, semanticOpts),
      aiService.generateQuiz(preparedText, 7, semanticOpts),
    ]);
<<<<<<< HEAD

=======
>>>>>>> main
    const localSummary = summaryResult.localSummary || "";
    const aiSummary = summaryResult.aiSummary || "";
    const mergedSummary = buildMergedSummary(localSummary, aiSummary);

    if (!mergedSummary) {
      console.warn("[lectureProcessing] Summary is empty — continuing without summary.");
    }

    lecture.transcript = Array.isArray(transcript) ? transcript : [];
    lecture.frames = frames;
<<<<<<< HEAD

=======
>>>>>>> main
    lecture.summary = {
      local: localSummary,
      ai: aiSummary,
      merged: mergedSummary,
    };
<<<<<<< HEAD

=======
>>>>>>> main
    lecture.quiz = {
      local: normalizeStringArray(quizResult.localQuiz),
      ai: normalizeStringArray(quizResult.aiQuiz),
      merged: normalizeStringArray(quizResult.mergedQuiz),
    };
<<<<<<< HEAD

    lecture.quizStructured = Array.isArray(quizResult.aiQuizStructured)
      ? quizResult.aiQuizStructured
      : [];

    lecture.status = "completed";
    lecture.errorMessage = "";

=======
    lecture.quizStructured = Array.isArray(quizResult.aiQuizStructured)
      ? quizResult.aiQuizStructured
      : [];
    lecture.status = "completed";
    lecture.errorMessage = "";
>>>>>>> main
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
<<<<<<< HEAD
};
=======
};
>>>>>>> main
