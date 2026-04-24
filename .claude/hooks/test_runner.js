const { execSync } = require("child_process");

try {
  console.log("🧪 Running tests...");
  execSync("npm run test", { stdio: "inherit" });
} catch (e) {
  console.log("❌ Tests failed");
}