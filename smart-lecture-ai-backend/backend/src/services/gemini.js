/**
 * LLM Client: Gemini primary + Groq fallback.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
const GROQ_MODEL = "llama-3.3-70b-versatile";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

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
  const client = getGemini();
  if (!client) throw new Error("GEMINI_API_KEY not set");

  const model = client.getGenerativeModel({
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
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.4,
  });

  return completion.choices[0].message.content;
}

async function groqJSONCall(systemPrompt, userMessage, opts) {
  const client = getGroq();
  if (!client) throw new Error("GROQ_API_KEY not set");

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: `${systemPrompt}\nRespond ONLY with valid JSON, no markdown.` },
      { role: "user", content: userMessage },
    ],
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.3,
    response_format: { type: "json_object" },
  });

  return completion.choices[0].message.content;
}

function isRetryable(err) {
  const message = err.message || "";
  return message.includes("429") || message.includes("quota") || message.includes("503") || message.includes("overloaded");
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
  if (GEMINI_API_KEY) {
    for (const modelName of GEMINI_MODELS) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
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

  if (GROQ_API_KEY) {
    log(`Falling back to Groq (${GROQ_MODEL})...`);
    const result = await groqCall(systemPrompt, userMessage, opts);
    log(`Success via Groq (${GROQ_MODEL})`);
    return result;
  }

  throw new Error("No LLM API available. Set GEMINI_API_KEY or GROQ_API_KEY in .env");
}

async function geminiChat(systemPrompt, userMessage, opts = {}) {
  return callWithFallback(geminiChatCall, groqChatCall, systemPrompt, userMessage, opts);
}

async function geminiJSON(systemPrompt, userMessage, opts = {}) {
  const raw = await callWithFallback(geminiJSONCall, groqJSONCall, systemPrompt, userMessage, opts);
  return typeof raw === "object" ? raw : parseJSON(raw);
}

module.exports = { geminiChat, geminiJSON, GEMINI_MODELS, GROQ_MODEL };
