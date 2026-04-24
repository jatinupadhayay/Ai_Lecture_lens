const fs = require("fs");

const input = fs.readFileSync(0, "utf-8");

// ❌ Block boring SaaS styles
const banned = [
  "bg-white",
  "text-black",
  "bg-indigo",
  "blue-",
  "shadow-md",
  "rounded-sm"
];

// ✅ Encourage education theme
const requiredHints = [
  "bg-[#0B0F19]",
  "text-[#E5E7EB]",
  "accent-[#EAB308]"
];

for (let b of banned) {
  if (input.includes(b)) {
    console.log("❌ Avoid generic SaaS colors (blue/white). Use education theme.");
    process.exit(1);
  }
}

// Suggest improvements
if (input.includes("className") && !input.includes("#EAB308")) {
  console.log("⚠️ Add golden accent (#EAB308) for educational feel.");
}

process.exit(0);