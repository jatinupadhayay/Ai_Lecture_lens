/**
 * LLM Client — Gemini 2.0 Flash (primary) + Groq Llama (fallback)
 *
 * Both are FREE. Gemini is preferred for quality; Groq is the fallback
 * when Gemini quota is exhausted.
 *
 * Usage:
 *   const { geminiChat, geminiJSON } = require("./gemini");
 *   const text = await geminiChat(systemPrompt, userMessage);
 *   const data = await geminiJSON(systemPrompt, userMessage);
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

// ── Config ──
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
const GROQ_MODEL = "llama-3.3-70b-versatile";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

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
  const genAI = getGemini();
  if (!genAI) throw new Error("GEMINI_API_KEY not set");

  const model = genAI.getGenerativeModel({
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
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.4,
  });

  return completion.choices[0].message.content;
}

async function groqJSONCall(systemPrompt, userMessage, opts) {
  const groq = getGroq();
  if (!groq) throw new Error("GROQ_API_KEY not set");

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: systemPrompt + "\nRespond ONLY with valid JSON, no markdown." },
      { role: "user", content: userMessage },
    ],
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.3,
    response_format: { type: "json_object" },
  });

  return completion.choices[0].message.content;
}

// ══════════════════════════════════════════════
// Unified caller: Gemini → Groq fallback
// ══════════════════════════════════════════════

function isRetryable(err) {
  const msg = err.message || "";
  return msg.includes("429") || msg.includes("quota") || msg.includes("503") || msg.includes("overloaded");
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
  // ── Try Gemini models first ──
  if (GEMINI_API_KEY) {
    for (const modelName of GEMINI_MODELS) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
  }

  throw new Error("No LLM API available. Set GEMINI_API_KEY or GROQ_API_KEY in .env");
}

// ══════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════

/**
 * Chat completion — returns text string.
 */
async function geminiChat(systemPrompt, userMessage, opts = {}) {
  return callWithFallback(geminiChatCall, groqChatCall, systemPrompt, userMessage, opts);
}

/**
 * JSON completion — returns parsed object.
 */
async function geminiJSON(systemPrompt, userMessage, opts = {}) {
  const raw = await callWithFallback(geminiJSONCall, groqJSONCall, systemPrompt, userMessage, opts);
  return typeof raw === "object" ? raw : parseJSON(raw);
}

module.exports = { geminiChat, geminiJSON, GEMINI_MODELS, GROQ_MODEL };
