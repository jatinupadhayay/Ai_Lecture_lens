const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, allowRoles } = require('../middlewares/auth');
const lecturesController = require('../controllers/lectureController'); // ✅ use one import name

// 🗂 Configure Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.STORAGE_LOCAL_PATH || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '_' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || `${300 * 1024 * 1024}`, 10), // default 300MB
  },
  fileFilter: (req, file, cb) => {
    // Allow video/audio/ppt/pdf/pptx
    if (
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.ms-powerpoint' ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
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
  ]),
  lecturesController.uploadLecture // ✅ fixed naming
);

// 📚 Get all lectures
router.get('/', protect, lecturesController.getLectures);

// 📘 Get single lecture
router.get('/:id', protect, lecturesController.getLectureById);

// 🧾 Get lecture summary (AI + Local)
router.get('/:id/summary', protect, lecturesController.getLectureSummary);

router.post("/:id/process", protect, lecturesController.processLecture)

module.exports = router;
