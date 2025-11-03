require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const lectureRoutes = require('./routes/lectures');
const quizRoutes = require('./routes/quizzes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ✅ Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve uploaded files (ensures /uploads/ URLs work)
const __dirnameRoot = path.resolve();
app.use('/uploads', express.static(path.join(__dirnameRoot, 'uploads')));

// ✅ Health check routes
app.get('/', (req, res) => res.send('🚀 Smart Lecture AI Backend Running'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ✅ API Routes
app.use('/api/auth', authRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/quizzes', quizRoutes);

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
