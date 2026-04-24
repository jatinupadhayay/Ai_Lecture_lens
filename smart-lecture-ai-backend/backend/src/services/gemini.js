/**
<<<<<<< HEAD
 * LLM Client: Gemini primary + Groq fallback.
=======
 * LLM Client — Gemini 2.0 Flash (primary) + Groq Llama (fallback)
 *
 * Both are FREE. Gemini is preferred for quality; Groq is the fallback
 * when Gemini quota is exhausted.
 *
 * Usage:
 *   const { geminiChat, geminiJSON } = require("./gemini");
 *   const text = await geminiChat(systemPrompt, userMessage);
 *   const data = await geminiJSON(systemPrompt, userMessage);
>>>>>>> main
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

<<<<<<< HEAD
=======
// ── Config ──
>>>>>>> main
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
const GROQ_MODEL = "llama-3.3-70b-versatile";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

<<<<<<< HEAD
let genAI = null;
let groq = null;

function getGemini() {
  if (!genAI && GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

function getGroq() {
  if (!groq && GROQ_API_KEY) {
    groq = new Groq({ apiKey: GROQ_API_KEY });
  }
  return groq;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...msg) => console.log("[llm]", ...msg);
const errLog = (...msg) => console.error("[llm]", ...msg);

async function geminiChatCall(systemPrompt, userMessage, opts, modelName) {
  const client = getGemini();
  if (!client) throw new Error("GEMINI_API_KEY not set");

  const model = client.getGenerativeModel({
=======
// ── Clients (lazy init) ──
let _genAI = null;
let _groq = null;

function getGemini() {
  if (!_genAI && GEMINI_API_KEY) {
    _genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return _genAI;
}

function getGroq() {
  if (!_groq && GROQ_API_KEY) {
    _groq = new Groq({ apiKey: GROQ_API_KEY });
  }
  return _groq;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log("[llm]", ...m);
const errLog = (...m) => console.error("[llm]", ...m);

// ══════════════════════════════════════════════
// Gemini providers
// ══════════════════════════════════════════════

async function geminiChatCall(systemPrompt, userMessage, opts, modelName) {
  const genAI = getGemini();
  if (!genAI) throw new Error("GEMINI_API_KEY not set");

  const model = genAI.getGenerativeModel({
>>>>>>> main
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 2048,
      temperature: opts.temperature ?? 0.4,
    },
  });

  const chat = model.startChat({ history: opts.history || [] });
  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

async function geminiJSONCall(systemPrompt, userMessage, opts, modelName) {
<<<<<<< HEAD
  const client = getGemini();
  if (!client) throw new Error("GEMINI_API_KEY not set");

  const model = client.getGenerativeModel({
=======
  const genAI = getGemini();
  if (!genAI) throw new Error("GEMINI_API_KEY not set");

  const model = genAI.getGenerativeModel({
>>>>>>> main
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 2048,
      temperature: opts.temperature ?? 0.3,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}

<<<<<<< HEAD
async function groqChatCall(systemPrompt, userMessage, opts) {
  const client = getGroq();
  if (!client) throw new Error("GROQ_API_KEY not set");

  const history = (opts.history || []).map((message) => ({
    role: message.role === "model" ? "assistant" : message.role,
    content: message.parts ? message.parts.map((part) => part.text).join("") : message.content || "",
  }));

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ],
=======
// ══════════════════════════════════════════════
// Groq fallback
// ══════════════════════════════════════════════

async function groqChatCall(systemPrompt, userMessage, opts) {
  const groq = getGroq();
  if (!groq) throw new Error("GROQ_API_KEY not set");

  // Convert Gemini history format to OpenAI-style messages
  const history = (opts.history || []).map((m) => ({
    role: m.role === "model" ? "assistant" : m.role,
    content: m.parts ? m.parts.map((p) => p.text).join("") : m.content || "",
  }));

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
>>>>>>> main
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.4,
  });

  return completion.choices[0].message.content;
}

async function groqJSONCall(systemPrompt, userMessage, opts) {
<<<<<<< HEAD
  const client = getGroq();
  if (!client) throw new Error("GROQ_API_KEY not set");

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: `${systemPrompt}\nRespond ONLY with valid JSON, no markdown.` },
=======
  const groq = getGroq();
  if (!groq) throw new Error("GROQ_API_KEY not set");

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: systemPrompt + "\nRespond ONLY with valid JSON, no markdown." },
>>>>>>> main
      { role: "user", content: userMessage },
    ],
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.3,
    response_format: { type: "json_object" },
  });

  return completion.choices[0].message.content;
}

<<<<<<< HEAD
function isRetryable(err) {
  const message = err.message || "";
  return message.includes("429") || message.includes("quota") || message.includes("503") || message.includes("overloaded");
=======
// ══════════════════════════════════════════════
// Unified caller: Gemini → Groq fallback
// ══════════════════════════════════════════════

function isRetryable(err) {
  const msg = err.message || "";
  return msg.includes("429") || msg.includes("quota") || msg.includes("503") || msg.includes("overloaded");
>>>>>>> main
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    throw new Error(`Invalid JSON: ${raw.slice(0, 200)}`);
  }
}

async function callWithFallback(geminiCall, groqCall, systemPrompt, userMessage, opts) {
<<<<<<< HEAD
  if (GEMINI_API_KEY) {
    for (const modelName of GEMINI_MODELS) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
=======
  // ── Try Gemini models first ──
  if (GEMINI_API_KEY) {
    for (const modelName of GEMINI_MODELS) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
>>>>>>> main
        try {
          const result = await geminiCall(systemPrompt, userMessage, opts, modelName);
          log(`Success via Gemini (${modelName})`);
          return result;
        } catch (err) {
          if (isRetryable(err) && attempt < MAX_RETRIES) {
            errLog(`${modelName} rate limited, retrying in ${RETRY_DELAY_MS}ms...`);
            await sleep(RETRY_DELAY_MS);
            continue;
          }
          if (isRetryable(err)) {
            errLog(`${modelName} exhausted, trying next...`);
            break;
          }
          errLog(`${modelName} error:`, err.message?.slice(0, 150));
          break;
        }
      }
    }
  }

<<<<<<< HEAD
  if (GROQ_API_KEY) {
    log(`Falling back to Groq (${GROQ_MODEL})...`);
    const result = await groqCall(systemPrompt, userMessage, opts);
    log(`Success via Groq (${GROQ_MODEL})`);
    return result;
=======
  // ── Fallback to Groq ──
  if (GROQ_API_KEY) {
    try {
      log(`Falling back to Groq (${GROQ_MODEL})...`);
      const result = await groqCall(systemPrompt, userMessage, opts);
      log(`Success via Groq (${GROQ_MODEL})`);
      return result;
    } catch (err) {
      errLog("Groq failed:", err.message?.slice(0, 150));
      throw err;
    }
>>>>>>> main
  }

  throw new Error("No LLM API available. Set GEMINI_API_KEY or GROQ_API_KEY in .env");
}

<<<<<<< HEAD
=======
// ══════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════

/**
 * Chat completion — returns text string.
 */
>>>>>>> main
async function geminiChat(systemPrompt, userMessage, opts = {}) {
  return callWithFallback(geminiChatCall, groqChatCall, systemPrompt, userMessage, opts);
}

<<<<<<< HEAD
=======
/**
 * JSON completion — returns parsed object.
 */
>>>>>>> main
async function geminiJSON(systemPrompt, userMessage, opts = {}) {
  const raw = await callWithFallback(geminiJSONCall, groqJSONCall, systemPrompt, userMessage, opts);
  return typeof raw === "object" ? raw : parseJSON(raw);
}

module.exports = { geminiChat, geminiJSON, GEMINI_MODELS, GROQ_MODEL };
