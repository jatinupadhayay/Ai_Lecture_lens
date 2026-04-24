/**
 * LLM Client: Gemini primary + Groq fallback.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

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

async function callGemini(modelName, systemPrompt, userMessage, opts = {}) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
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
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 2048,
      temperature: opts.temperature ?? 0.7,
    },
  });
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
async function callGroq(systemPrompt, userMessage, opts = {}) {
  const completion = await groqClient.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.7,
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
/**
 * Call Gemini with automatic fallback: Gemini Flash → Flash Lite → Groq Llama.
 */
async function geminiChat(systemPrompt, userMessage, opts = {}) {
  if (genAI) {
    for (const modelName of GEMINI_MODELS) {
      try {
        return await callGemini(modelName, systemPrompt, userMessage, opts);
      } catch (err) {
        const status = err?.status || err?.response?.status;
        if (status === 429 || status === 503) {
          console.warn(`[gemini] ${modelName} quota/overload, trying next...`);
          await sleep(1000);
          continue;
        }
        throw err;
      }
    }
  }

  if (GROQ_API_KEY) {
    log(`Falling back to Groq (${GROQ_MODEL})...`);
    const result = await groqCall(systemPrompt, userMessage, opts);
    log(`Success via Groq (${GROQ_MODEL})`);
    return result;
  if (groqClient) {
    console.warn("[gemini] All Gemini models failed, falling back to Groq Llama...");
    return await callGroq(systemPrompt, userMessage, opts);
  }

  throw new Error("No LLM available. Set GEMINI_API_KEY or GROQ_API_KEY.");
}

async function geminiChat(systemPrompt, userMessage, opts = {}) {
  return callWithFallback(geminiChatCall, groqChatCall, systemPrompt, userMessage, opts);
}

 */
async function geminiJSON(systemPrompt, userMessage, opts = {}) {
  const raw = await geminiChat(
    systemPrompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code blocks.",
    userMessage,
    opts
  );

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting first JSON object/array
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]);
    throw new Error(`geminiJSON: could not parse response as JSON:\n${cleaned.slice(0, 300)}`);
  }
}

module.exports = { geminiChat, geminiJSON };
