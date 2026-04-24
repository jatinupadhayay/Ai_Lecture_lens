const { execSync } = require("child_process");

try {
  console.log("🎨 Running Prettier...");
  execSync("npx prettier --write .", { stdio: "inherit" });
} catch (e) {
  console.log("⚠️ Formatter failed");
}