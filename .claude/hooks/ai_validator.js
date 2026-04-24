const fs = require("fs");

const input = fs.readFileSync(0, "utf-8");

if (input.includes("summary") && input.length < 100) {
  console.log("⚠️ AI summary too short. Improve quality.");
}

if (input.includes("quiz") && !input.includes("?")) {
  console.log("⚠️ Quiz questions missing proper format.");
}