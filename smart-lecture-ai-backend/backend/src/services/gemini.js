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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callGemini(modelName, systemPrompt, userMessage, opts = {}) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 2048,
      temperature: opts.temperature ?? 0.7,
    },
  });
  return result.response.text();
}

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

  if (groqClient) {
    console.warn("[gemini] All Gemini models failed, falling back to Groq Llama...");
    return await callGroq(systemPrompt, userMessage, opts);
  }

  throw new Error("No LLM available. Set GEMINI_API_KEY or GROQ_API_KEY.");
}

/**
 * Same as geminiChat but parses the response as JSON.
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
