const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, allowRoles } = require('../middlewares/auth');
const lecturesController = require('../controllers/lectureController');

// ── Storage: Cloudinary (if configured) or local disk ──
let storage;

if (process.env.CLOUDINARY_CLOUD_NAME) {
  const cloudinary = require('../config/cloudinary');
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: 'lecture-lens',
      resource_type: 'auto',
      public_id: `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      // Keep original file for AI processing (no transformation at upload time)
      transformation: [],
    }),
  });
} else {
  const fs = require('fs');
  const uploadDir = process.env.STORAGE_LOCAL_PATH || './uploads';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + '_' + file.originalname);
    },
  });
}

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || `${300 * 1024 * 1024}`, 10),
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.ms-powerpoint' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

// 🧠 Teacher or Student uploads lecture (video/audio/ppt or YouTube/audio URL)
router.post(
  '/upload',
  protect,
  allowRoles('teacher', 'student'),
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'ppt', maxCount: 1 },
    { name: 'book', maxCount: 5 },
  ]),
  lecturesController.uploadLecture // ✅ fixed naming
);

// 🗑 Delete lecture
router.delete('/:id', protect, lecturesController.deleteLecture);

// 📚 Get all lectures
router.get('/', protect, lecturesController.getLectures);

// 📘 Get single lecture
router.get('/:id', protect, lecturesController.getLectureById);

// 🧾 Get lecture summary (AI + Local)
router.get('/:id/summary', protect, lecturesController.getLectureSummary);

router.post("/:id/process", protect, lecturesController.processLecture);

// Upload books to an existing lecture
router.post(
  "/:id/books",
  protect,
  upload.fields([{ name: 'book', maxCount: 5 }]),
  lecturesController.uploadBookToLecture
);

module.exports = router;
