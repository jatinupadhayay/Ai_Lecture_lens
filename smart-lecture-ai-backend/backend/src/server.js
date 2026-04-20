require('dotenv').config();
require('express-async-errors');

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Ensure tmp/docs exists for document uploads
fs.mkdirSync(path.join(process.cwd(), 'tmp', 'docs'), { recursive: true });
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const lectureRoutes = require('./routes/lectures');
const quizRoutes = require('./routes/quizzes');
const analyticsRoutes = require('./routes/analytics');
const documentRoutes = require('./routes/documents');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ✅ CORS — lock to FRONTEND_URL in production
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : true, // allow all in dev
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // polling-friendly: ~1 req/2s sustained
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// ✅ Serve uploaded files
const __dirnameRoot = path.resolve();
app.use('/uploads', express.static(path.join(__dirnameRoot, 'uploads')));

// ✅ Health check
app.get('/', (req, res) => res.send('Lecture Lens API Running'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ✅ API Routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/lectures', apiLimiter, lectureRoutes);
app.use('/api/quizzes', apiLimiter, quizRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);
app.use('/api/documents', apiLimiter, documentRoutes);

// ✅ Error handler
app.use(errorHandler);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartlecture')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  });
