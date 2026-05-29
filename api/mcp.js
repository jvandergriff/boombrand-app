/**
 * BoomBrand Hosted MCP Server
 * Implements MCP protocol over HTTP for Vercel serverless
 * Connect from any Claude client: https://app.boombrand.ai/api/mcp
 */

import { readFileSync } from "fs";
import { join } from "path";

// ── LOAD VOICES ───────────────────────────────────────────────────────────────
function loadVoices() {
  try {
    const path = join(process.cwd(), "voices.json");
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return [];
  }
}

function findVoice(nameOrId) {
  const voices = loadVoices();
  const q = (nameOrId || "").toLowerCase();
  return voices.find(v =>
    v.id?.toLowerCase() === q ||
    v.name?.toLowerCase().includes(q) ||
    v.type?.toLowerCase() === q
  ) || voices[0];
}

// ── GENERATE SYSTEM PROMPT ────────────────────────────────────────────────────
function generateSystemPrompt(v, pieceType, audience) {
  const dial = v.tone?.dial || 5;
  const toneLabel = dial <= 3 ? "PUNCHY" : dial >= 7 ? "PRACTITIONER" : "BALANCED";
  const toneDesc = dial <= 3
    ? (v.tone?.punchy_description || "Direct, energetic, opinionated.")
    : dial >= 7
    ? (v.tone?.practitioner_description || "Confident, specific, evidence-led.")
    : "Balance by piece type.";

  const audienceData = audience && audience !== "all"
    ? v.audiences?.find(a => a.id === audience || a.name?.toLowerCase().includes(audience.toLowerCase()))
    : null;

  const audienceSection = audienceData
    ? `AUDIENCE: ${audienceData.name}
Who they are: ${audienceData.who}
What they measure: ${audienceData.measures}
Vocabulary that lands: ${audienceData.vocab_use}
Vocabulary to avoid: ${audienceData.vocab_avoid}`
    : v.audiences?.map(a => `• ${a.name}: ${a.who}. Use: ${a.vocab_use}. Avoid: ${a.vocab_avoid}.`).join("\n") || "";

  const products = v.products?.map(p => `• ${p.name}: ${p.description}`).join("\n") || "";
  const banned = [...(v.blocklist?.words || []), ...(v.blocklist?.phrases || [])];

  return `VOICE PROFILE: ${v.name}
${v.tagline ? `"${v.tagline}"\n` : ""}Type: ${v.type} | Updated: ${v.updatedAt?.slice(0, 10)}
${pieceType ? `Piece type: ${pieceType}` : ""}

WHO WE ARE
${v.identity?.mission || v.sentence_style || "Not defined."}

${v.identity?.what_we_are_not ? `WHAT WE ARE NOT\n${v.identity.what_we_are_not}\n` : ""}
TONE: ${toneLabel} (${dial}/10)
${toneDesc}
${v.tone?.choose_when ? `When to choose: ${v.tone.choose_when}` : ""}

${v.texture?.sentence_style || v.sentence_style ? `SENTENCE STYLE\n${v.texture?.sentence_style || v.sentence_style}\n` : ""}
${v.texture?.signature_moves || v.signature_moves ? `SIGNATURE MOVES\n${v.texture?.signature_moves || v.signature_moves}\n` : ""}
${audienceSection ? `AUDIENCES\n${audienceSection}\n` : ""}
${products ? `PRODUCTS\n${products}\n` : ""}
${banned.length ? `BANNED (never use)\n${banned.join(", ")}\n` : ""}
${(v.blocklist?.openers || []).length ? `BANNED OPENERS\n${v.blocklist.openers.join(", ")}\n` : ""}
${(v.allowlist?.words || []).length ? `ALLOWED\n${v.allowlist.words.join(", ")}\n` : ""}
RULES
${v.rules?.examples || v.attributes?.join(". ") || "Use real named examples."}
${v.rules?.numbers || "Numbers with interpretation."}
${v.rules?.conclusions || "No restate-the-intro conclusions."}
${v.rules?.custom ? "\nCUSTOM\n" + v.rules.custom : ""}
${v.system_prompt ? "\nSYSTEM PROMPT (full)\n" + v.system_prompt : ""}

SPELLING: ${v.texture?.spelling === "british" ? "British" : "American"} English always.
CONTRACTIONS: ${v.texture?.contractions !== false ? "Yes." : "Avoid."}
ONE-LINE TEST: If it could appear on any competitor's site unchanged — rewrite it.`;
}

// ── TOOL HANDLERS ─────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_voices",
    description: "List all available voice profiles in BoomBrand. Call this first to see what voices exist.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_voice",
    description: "Get a voice profile by name or ID with a ready-to-use system prompt. Call this before writing any content.",
    inputSchema: {
      type: "object",
      properties: {
        voice: { type: "string", description: "Voice name or ID. E.g. 'Seeker Brand Voice', 'founder', 'brand'" },
        piece_type: { type: "string", enum: ["thought_leadership", "product", "mixed", "general"] },
        audience: { type: "string", description: "Audience name or ID, or 'all'" },
      },
      required: ["voice"],
    },
  },
  {
    name: "ask_voice",
    description: "Ask a natural language question about a voice's rules. E.g. 'Can I use em dashes?'",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        voice: { type: "string", description: "Voice name or ID. Defaults to first voice." },
      },
      required: ["question"],
    },
  },
  {
    name: "score_content",
    description: "Score any content against a voice profile. Returns 0-100 score and issues to fix.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        voice: { type: "string", description: "Voice name or ID. Defaults to first voice." },
      },
      required: ["content"],
    },
  },
];

function handleListVoices() {
  const voices = loadVoices();
  return {
    count: voices.length,
    voices: voices.map(v => ({
      id: v.id, name: v.name, type: v.type, emoji: v.emoji,
      tagline: v.tagline, updated: v.updatedAt?.slice(0, 10),
    })),
    tip: "Call get_voice with a name to load the full profile and system prompt.",
  };
}

function handleGetVoice(args) {
  const v = findVoice(args.voice);
  if (!v) {
    const voices = loadVoices();
    return { error: `Voice "${args.voice}" not found.`, available: voices.map(v => v.name) };
  }
  return {
    id: v.id, name: v.name, type: v.type, emoji: v.emoji, tagline: v.tagline,
    system_prompt: generateSystemPrompt(v, args.piece_type, args.audience),
    attributes: v.attributes,
    vocabulary: v.vocabulary,
  };
}

function handleAskVoice(args) {
  const v = findVoice(args.voice) || loadVoices()[0];
  if (!v) return { error: "No voices found." };
  const q = args.question.toLowerCase();
  if (q.includes("em dash") || q.includes("dash")) return { answer: "EM DASHES ARE BANNED.", detail: "Replace with: period + new sentence, colon, comma, or parentheses." };
  if (q.includes("ban") || q.includes("never") || q.includes("avoid")) return { banned_words: v.blocklist?.words, banned_phrases: v.blocklist?.phrases, banned_openers: v.blocklist?.openers };
  if (q.includes("tone")) return { dial: v.tone?.dial, punchy: v.tone?.punchy_description, practitioner: v.tone?.practitioner_description, choose_when: v.tone?.choose_when };
  if (q.includes("audience")) return { audiences: v.audiences };
  if (q.includes("product") || q.includes("naming")) return { products: v.products, naming_rules: v.rules?.custom };
  if (q.includes("example")) return { rule: v.rules?.examples };
  if (q.includes("number") || q.includes("stat")) return { rule: v.rules?.numbers };
  if (q.includes("conclusion")) return { rule: v.rules?.conclusions };
  return { system_prompt: generateSystemPrompt(v) };
}

function handleScoreContent(args) {
  const v = findVoice(args.voice) || loadVoices()[0];
  if (!v) return { error: "No voices found." };
  const issues = [];
  const c = args.content.toLowerCase();
  const banned = [...(v.blocklist?.words || []), ...(v.blocklist?.phrases || [])];
  banned.forEach(w => { if (c.includes(w.toLowerCase())) issues.push({ severity: "high", issue: `"${w}" is banned` }); });
  if (/—/.test(args.content)) issues.push({ severity: "critical", issue: "Em dash found — banned. Replace with period, colon, comma, or parentheses." });
  if (c.includes("in conclusion")) issues.push({ severity: "critical", issue: "'In conclusion' found — delete and rewrite ending." });
  if (c.includes("our product") || c.includes("the platform")) issues.push({ severity: "high", issue: "Generic product reference — use the actual product name." });
  const score = Math.max(0, 100 - issues.filter(i => i.severity === "critical").length * 25 - issues.filter(i => i.severity === "high").length * 10);
  return { voice: v.name, score, grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D", issues, summary: issues.length === 0 ? "No issues found." : `${issues.length} issue(s) found.` };
}

// ── MCP PROTOCOL HANDLER ──────────────────────────────────────────────────────
function handleMCPRequest(body) {
  const { method, params, id } = body;

  const respond = (result) => ({ jsonrpc: "2.0", id, result });
  const error = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

  switch (method) {
    case "initialize":
      return respond({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "boombrand", version: "2.0.0" },
      });

    case "tools/list":
      return respond({ tools: TOOLS });

    case "tools/call": {
      const { name, arguments: args = {} } = params;
      let result;
      try {
        switch (name) {
          case "list_voices":   result = handleListVoices(); break;
          case "get_voice":     result = handleGetVoice(args); break;
          case "ask_voice":     result = handleAskVoice(args); break;
          case "score_content": result = handleScoreContent(args); break;
          default: return error(-32601, `Unknown tool: ${name}`);
        }
        return respond({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        return error(-32603, e.message);
      }
    }

    case "notifications/initialized":
      return null; // no response needed

    default:
      return error(-32601, `Method not found: ${method}`);
  }
}

// ── VERCEL HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      name: "BoomBrand MCP",
      version: "2.0.0",
      status: "ok",
      voices: loadVoices().length,
      connect_url: "https://app.boombrand.ai/api/mcp",
      instructions: "Add this URL as a custom MCP connector in Claude Desktop or any MCP-compatible client.",
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const response = handleMCPRequest(body);
    if (!response) return res.status(200).end();
    return res.status(200).json(response);
  } catch (e) {
    return res.status(500).json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error: " + e.message } });
  }
}
