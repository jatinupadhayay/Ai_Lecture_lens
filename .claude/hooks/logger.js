const fs = require("fs");

const log = `[${new Date().toISOString()}] Tool executed\n`;

fs.appendFileSync("hooks.log", log);