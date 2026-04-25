/**
 * LLM Client: Gemini primary + Groq fallback.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
const GROQ_MODEL = "llama-3.1-70b-versatile"; // Updated to a stable Groq model

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
  });

  const chat = model.startChat({ 
    history: opts.history || [],
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.7,
    }
  });

  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

async function groqChatCall(systemPrompt, userMessage, opts) {
  const client = getGroq();
  if (!client) throw new Error("GROQ_API_KEY not set");

  const history = (opts.history || []).map((message) => ({
    role: message.role === "model" ? "assistant" : (message.role === "user" ? "user" : "system"),
    content: typeof message.parts === 'string' ? message.parts : (Array.isArray(message.parts) ? message.parts.map(p => p.text).join("") : message.content || ""),
  }));

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ],
    max_tokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.4,
  });

  return completion.choices[0].message.content;
}

function isRetryable(err) {
  const status = err.status || err.response?.status;
  const message = err.message?.toLowerCase() || "";
  return (
    status === 429 || 
    status === 503 || 
    message.includes("quota") || 
    message.includes("overloaded") || 
    message.includes("rate limit")
  );
}

async function callWithFallback(geminiCall, groqCall, systemPrompt, userMessage, opts) {
  // Try Gemini models first
  if (GEMINI_API_KEY) {
    for (const modelName of GEMINI_MODELS) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
          const result = await geminiCall(systemPrompt, userMessage, opts, modelName);
          log(`Success via Gemini (${modelName})`);
          return result;
        } catch (err) {
          if (isRetryable(err)) {
            if (attempt < MAX_RETRIES) {
              errLog(`${modelName} rate limited, retrying in ${RETRY_DELAY_MS}ms...`);
              await sleep(RETRY_DELAY_MS);
              continue;
            }
            errLog(`${modelName} exhausted, trying next...`);
            break; // Try next Gemini model
          }
          errLog(`${modelName} terminal error:`, err.message?.slice(0, 150));
          break; // Try next Gemini model
        }
      }
    }
  }

  // Fallback to Groq
  if (GROQ_API_KEY) {
    try {
      log(`Falling back to Groq (${GROQ_MODEL})...`);
      const result = await groqCall(systemPrompt, userMessage, opts);
      log(`Success via Groq (${GROQ_MODEL})`);
      return result;
    } catch (err) {
      errLog(`Groq fallback failed: ${err.message}`);
    }
  }

  throw new Error("No LLM available or all models failed. Set GEMINI_API_KEY or GROQ_API_KEY.");
}

/**
 * Call Gemini primary with Groq fallback.
 */
async function geminiChat(systemPrompt, userMessage, opts = {}) {
  return callWithFallback(geminiChatCall, groqChatCall, systemPrompt, userMessage, opts);
}

/**
 * Call Gemini/Groq and ensure JSON output.
 */
async function geminiJSON(systemPrompt, userMessage, opts = {}) {
  const jsonPrompt = `${systemPrompt}\n\nIMPORTANT: Your response MUST be valid JSON only. Do not include any explanation, markdown formatting, or code blocks.`;
  
  const raw = await geminiChat(jsonPrompt, userMessage, opts);

  // Clean raw string (strip markdown code fences if present)
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Try to extract JSON object/array from the text if parsing failed
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (innerErr) {
        // failed again
      }
    }
    errLog("geminiJSON: Failed to parse as JSON. Raw output:", raw.slice(0, 500));
    throw new Error(`Failed to parse LLM response as JSON: ${err.message}`);
  }
}

module.exports = { geminiChat, geminiJSON };
