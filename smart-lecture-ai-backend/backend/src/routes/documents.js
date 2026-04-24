const express = require("express");
const multer = require("multer");
const path = require("path");
const { protect } = require("../middlewares/auth");
const {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  chatWithDocument,
  clearChat,
} = require("../controllers/documentController");

const router = express.Router();

// Multer — preserve file extension so Python can detect type
const storage = multer.diskStorage({
  destination: path.join(process.cwd(), "tmp", "docs"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx", ".doc", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(", ")}`));
    }
  },
});

router.use(protect);

router.post("/upload", upload.single("file"), uploadDocument);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.delete("/:id", deleteDocument);
router.post("/:id/chat", chatWithDocument);
router.delete("/:id/chat", clearChat);

module.exports = router;
