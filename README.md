📘 Smart Lecture Lens
Learn Smarter from Your Classrooms using AI

Smart Lecture Lens is an AI-powered educational platform that automatically converts lecture videos into structured summaries, bilingual transcripts, and intelligent quizzes. The system helps students revise efficiently and enables educators to analyze learning outcomes using modern AI and NLP technologies.

🚀 Problem Statement

Students often struggle with:

Extracting key points from long lecture videos

Manually preparing summaries and notes

Creating self-assessment quizzes

Revising efficiently before exams

Traditional note-taking and repeated video watching are time-consuming and ineffective.

💡 Solution Overview

Smart Lecture Lens automates the entire learning reinforcement pipeline:

Upload lecture videos

Generate accurate transcripts (English + Hindi)

Extract text from slides/boards using OCR

Create concise AI-based summaries

Auto-generate quizzes for self-assessment

Track student performance

This reduces cognitive load and promotes active learning.

🧠 Key Features

🎥 Lecture video upload (AWS S3)

🗣️ Speech-to-text transcription (Whisper)

📝 AI-powered summarization (T5 / Transformers)

❓ Automatic quiz generation

🌐 Bilingual transcript support

📊 Student performance tracking

☁️ Cloud-based storage & access

⚡ Asynchronous processing (Celery + Redis)

🏗️ System Architecture
Frontend (React + Vite)
        ↓
Backend (Node.js + Express)
        ↓
AWS S3 (Video Storage)
        ↓
AI Processing Service (Python + Celery)
        ↓
Database (MongoDB / PostgreSQL)

🛠️ Tech Stack
Frontend

React.js (Vite)

Tailwind CSS

Axios

Backend

Node.js + Express

JWT Authentication

Docker

Database

MongoDB / PostgreSQL

Redis (Task Queue)

AI & NLP

OpenAI Whisper (Speech-to-Text)

T5 Transformer (Summarization & Quiz Generation)

spaCy, NLTK

OpenCV + Pytesseract (OCR)

Cloud & DevOps

AWS S3 (Video Storage)

Docker & Docker Compose

Celery (Async Tasks)

🔁 Workflow

User registers & logs in

Lecture video is uploaded

Audio is transcribed using Whisper

Video frames processed using OCR

NLP models generate summary

Quiz questions created from content

Results displayed on dashboard
