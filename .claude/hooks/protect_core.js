const fs = require("fs");

const input = fs.readFileSync(0, "utf-8");

const restricted = [
  "auth",
  "jwt",
  "config",
  ".env"
];

for (let key of restricted) {
  if (input.toLowerCase().includes(key)) {
    console.log("❌ Access denied: Sensitive file.");
    process.exit(1);
  }
}

process.exit(0);