const { execSync } = require("child_process");
const fs = require("fs");

const input = fs.readFileSync(0, "utf-8");

// Trigger only when lecture-related files are modified
if (input.toLowerCase().includes("lecture")) {
  try {
    console.log("🧠 Running AI pipeline...");

    execSync("python ai_pipeline/main.py", {
      stdio: "inherit"
    });

  } catch (e) {
    console.log("❌ Python AI pipeline failed");
  }
}