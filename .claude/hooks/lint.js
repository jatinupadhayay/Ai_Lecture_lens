const { execSync } = require("child_process");

try {
  console.log("🧹 Running ESLint...");
  execSync("npx eslint . --fix", { stdio: "inherit" });
} catch (e) {
  console.log("⚠️ Lint issues found");
}