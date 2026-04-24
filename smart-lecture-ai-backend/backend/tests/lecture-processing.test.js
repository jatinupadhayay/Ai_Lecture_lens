const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildLectureText,
  buildMergedSummary,
} = require("../src/services/lectureProcessing");

test("buildLectureText prefers transcript content when available", () => {
  const text = buildLectureText(
    [{ text: "Intro to neural networks" }, { text: "Gradient descent basics" }],
    [{ text: "Slide text should not be used first" }]
  );

  assert.equal(text, "Intro to neural networks Gradient descent basics");
});

test("buildLectureText falls back to extracted frame text", () => {
  const text = buildLectureText([], [
    { text: "Frame 1 notes" },
    { text: "Frame 2 notes" },
  ]);

  assert.equal(text, "Frame 1 notes Frame 2 notes");
});

test("buildMergedSummary joins only the available summary parts", () => {
  assert.equal(
    buildMergedSummary("Local summary", "AI summary"),
    "Local summary\n\n---\n\nAI summary"
  );
  assert.equal(buildMergedSummary("Local summary", ""), "Local summary");
});
