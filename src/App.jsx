import { useState, useRef, useEffect } from "react";
import {
  BoomScoreEntry,
  BoomScoreLoading,
  BoomScoreResults,
  ScoreHistoryCard,
  loadScoreHistory,
  saveScoreHistory,
} from "./BoomScore";

// ── STORAGE ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "boombrand_voices_v1";
function loadVoices() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveVoices(voices) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(voices)); } catch {}
}
function makeId() { return Math.random().toString(36).slice(2, 10); }

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const TYPE_META = {
  brand:   { color: "#7C5CFC", bg: "#F0EBFF", label: "Brand Voice" },
  product: { color: "#0EA5E9", bg: "#E0F4FF", label: "Product Voice" },
  founder: { color: "#F59E0B", bg: "#FEF3C7", label: "Founder Voice" },
};
const EMOJIS = ["🧭","🚀","⚡","🎯","🔥","💡","🌟","🎨","🦁","🐯","🦊","🎸","🎤","🏆","💎","🌈","🍀","🔮","🎭","🦋","🌊","🏔","🌺","🐉","👑","✨","💫","⭐","🌙","🎪"];

// ── AI PROMPTS ────────────────────────────────────────────────────────────────
const INTERVIEWER_SYSTEM = `You are BoomBrand's voice discovery AI. Your job is to have a natural, adaptive conversation that reveals someone's authentic brand or personal voice — not ask them to describe it.

CONVERSATION RULES:
- Ask ONE question at a time. Never multiple questions.
- Each question must build directly on what they just said. Reference their specific words.
- Don't use corporate language. Be warm, curious, direct.
- After 5-7 exchanges, respond with exactly this JSON (no markdown fences, no other text): {"done": true, "exchanges": <number>}

ADAPTIVE QUESTION LOGIC:
- FOUNDER/PERSON: origin stories, frustrations, beliefs, what makes them angry, what they'd never say
- BRAND/COMPANY: customers, what makes competitors cringe, unfair advantage, feeling they create
- PRODUCT: problem it solves, who it's really for, what it replaces, what surprises users

Always dig into SPECIFICS. "You mentioned X — give me the most extreme version of that."`;

const ANALYZER_SYSTEM = `You are BoomBrand's voice analyst. Analyze HOW someone communicates from this conversation — not just WHAT they said.

Output ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "suggested voice name",
  "emoji": "single most fitting emoji",
  "tagline": "one sentence this voice would say about itself in their own register",
  "type": "brand or founder or product",
  "attributes": ["3-5 specific concrete voice attributes"],
  "vocabulary": {
    "reach_for": ["6-8 specific words/phrases they used or would use"],
    "never_use": ["5-6 words that feel wrong for this voice"]
  },
  "sentence_style": "2-3 sentences describing their rhythm and structure",
  "signature_moves": "2-3 specific rhetorical habits from the conversation",
  "what_good_looks_like": "one example sentence in their voice",
  "what_bad_looks_like": "one example sentence that sounds nothing like them",
  "system_prompt": "200-250 word system prompt for AI tools to write in this voice — specific, grounded in observed patterns"
}`;

const BRAND_RESEARCH_SYSTEM = `You are BoomBrand's brand intelligence engine. Given a brand's URL, research them thoroughly using web_search and return surprising insights.

Use web_search to find:
1. Brand name + "reviews" — customer sentiment on G2, Captorate, Trustpilot, Reddit
2. Brand name + site:reddit.com — unfiltered real talk
3. Brand name + "vs" — how they're compared to competitors
4. "what is [brand]" — AI perception
5. Brand name + competitors in their space

Return ONLY valid JSON, no markdown:
{
  "brand_name": "detected name",
  "category": "their industry/category",
  "what_they_say": "how they describe themselves in 1-2 sentences",
  "what_others_say": "how customers/internet describes them — should differ from above",
  "voice_score": <0-100>,
  "voice_grade": "A/B/C/D/F",
  "surprises": [
    { "icon": "emoji", "title": "short finding", "insight": "2-3 specific sentences with real sources/quotes", "opportunity": "1 sentence on what to do with this" }
  ],
  "vocabulary": {
    "they_own": ["words distinctively theirs"],
    "competitors_own": ["words competitors use they should avoid"],
    "customers_use": ["words customers use that the brand doesn't"]
  },
  "voice_gaps": ["3-4 specific gaps between how they present vs how they're perceived"],
  "first_question": "the single sharpest question to open the voice discovery conversation, informed by what you found"
}`;

// ── API CALL ──────────────────────────────────────────────────────────────────
async function callAPI(messages, system, maxTokens = 400, useSearch = false) {
  const body = { model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, system, messages };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("Server error: " + raw.slice(0, 200)); }
  if (!res.ok || data.error) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || JSON.stringify(data).slice(0, 200));
  // Web search responses may have multiple blocks — find the last text block
  const textBlocks = data.content?.filter(b => b.type === "text");
  const text = textBlocks?.[textBlocks.length - 1]?.text;
  if (!text) throw new Error("No text response from AI");
  return text;
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────
function VoiceAvatar({ voice, size = 40 }) {
  const meta = TYPE_META[voice.type] || TYPE_META.brand;
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: meta.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.48, flexShrink: 0, border: `1.5px solid ${meta.color}22` }}>
      {voice.emoji || "🚀"}
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#7C5CFC",
          animation: "bounce 1.2s ease infinite", animationDelay: `${i*0.15}s`, opacity: 0.7 }}/>
      ))}
    </div>
  );
}

function Logo({ size = 160 }) {
  const h = Math.round(size * 27/160);
  return (
    <svg width={size} height={h} viewBox="0 0 480 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="76" height="76" rx="18" fill="none" stroke="#7C5CFC" strokeWidth="3.5"/>
      <rect x="15" y="15" width="50" height="50" rx="12" fill="#7C5CFC"/>
      <text x="40" y="51" fontFamily="system-ui,sans-serif" fontSize="32" fontWeight="700" fill="white" textAnchor="middle">B</text>
      <text fontFamily="system-ui,sans-serif" fontSize="54" letterSpacing="-1.6">
        <tspan x="96" y="60" fontWeight="700" fill="#1A1A2E">boom</tspan>
        <tspan fontWeight="300" fill="#C4B5FD">brand</tspan>
      </text>
    </svg>
  );
}

// ── VOICE REVEAL ──────────────────────────────────────────────────────────────
function VoiceReveal({ profile, onSave, onRetry }) {
  const [tab, setTab] = useState("character");
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);
  const [emoji, setEmoji] = useState(profile.emoji || "🚀");
  const [editEmoji, setEditEmoji] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F8F7FF 0%, #EDE8FF 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", padding: "48px 24px", fontFamily: "'Poppins',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes boom{0%{transform:scale(0.3) rotate(-10deg);opacity:0}70%{transform:scale(1.15) rotate(3deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes confetti{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(100px) rotate(720deg);opacity:0}}
      `}</style>
      {show && ["#7C5CFC","#F59E0B","#10B981","#F43F5E","#0EA5E9","#8B5CF6"].map((c,i)=>(
        <div key={i} style={{ position:"fixed", width:i%2===0?10:7, height:i%2===0?10:7,
          borderRadius:i%3===0?"50%":"2px", background:c, top:`${5+i*8}%`, left:`${8+i*15}%`,
          animation:`confetti ${1.5+i*0.2}s ease ${i*0.1}s forwards`, pointerEvents:"none" }}/>
      ))}
      <div style={{ maxWidth:640, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:36, opacity:show?1:0,
          transform:show?"none":"translateY(20px)", transition:"all 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s" }}>
          <div style={{ position:"relative", display:"inline-block", marginBottom:20 }}>
            <div onClick={()=>setEditEmoji(e=>!e)} style={{ width:100, height:100, borderRadius:28,
              background:"white", border:"3px solid #E8E4FF", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:54, cursor:"pointer", margin:"0 auto",
              boxShadow:"0 20px 60px rgba(124,92,252,0.15)",
              animation:show?"boom 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both":"none" }}>{emoji}</div>
            {editEmoji && (
              <div style={{ position:"absolute", top:110, left:"50%", transform:"translateX(-50%)",
                background:"white", border:"1px solid #E8E4FF", borderRadius:16, padding:12,
                display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:4, width:220,
                boxShadow:"0 8px 32px rgba(124,92,252,0.15)", zIndex:10 }}>
                {EMOJIS.map(e=>(
                  <button key={e} onClick={()=>{setEmoji(e);setEditEmoji(false)}}
                    style={{ width:30, height:30, border:"none", background:emoji===e?"#F0EBFF":"transparent",
                      borderRadius:6, fontSize:18, cursor:"pointer" }}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:"#7C5CFC", letterSpacing:"0.08em",
            textTransform:"uppercase", marginBottom:8 }}>Voice Discovered</div>
          <h1 style={{ fontSize:36, fontWeight:800, color:"#1A1A2E", letterSpacing:"-0.02em",
            lineHeight:1.1, marginBottom:10 }}>{profile.name}</h1>
          {profile.tagline && <p style={{ fontSize:17, color:"#6B7280", fontStyle:"italic",
            lineHeight:1.6, maxWidth:440, margin:"0 auto" }}>"{profile.tagline}"</p>}
        </div>

        <div style={{ background:"white", borderRadius:20, border:"1px solid #EDE8FF",
          boxShadow:"0 4px 40px rgba(124,92,252,0.08)", opacity:show?1:0,
          transform:show?"none":"translateY(20px)", transition:"all 0.5s ease 0.3s" }}>
          <div style={{ display:"flex", borderBottom:"1px solid #F0EEFF", padding:"0 6px" }}>
            {[{id:"character",label:"Character"},{id:"vocabulary",label:"Vocabulary"},{id:"prompt",label:"System Prompt"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"14px 20px", border:"none",
                background:"transparent", fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:600,
                cursor:"pointer", color:tab===t.id?"#7C5CFC":"#9CA3AF",
                borderBottom:`2.5px solid ${tab===t.id?"#7C5CFC":"transparent"}`, transition:"all 0.15s" }}>{t.label}</button>
            ))}
          </div>
          <div style={{ padding:28 }}>
            {tab==="character" && <div style={{ animation:"slideUp 0.2s ease" }}>
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
                  color:"#9CA3AF", marginBottom:10, fontFamily:"'JetBrains Mono',monospace" }}>Voice Attributes</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {(profile.attributes||[]).map((a,i)=>(
                    <span key={i} style={{ padding:"6px 14px", background:"#F0EBFF", color:"#7C5CFC",
                      borderRadius:100, fontSize:13, fontWeight:500 }}>{a}</span>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:16, padding:"16px 18px", background:"#FAFBFF", borderRadius:12, border:"1px solid #EDE8FF" }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
                  color:"#9CA3AF", marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>Sentence Style</div>
                <p style={{ fontSize:14, color:"#374151", lineHeight:1.7 }}>{profile.sentence_style}</p>
              </div>
              <div style={{ marginBottom:16, padding:"16px 18px", background:"#FAFBFF", borderRadius:12, border:"1px solid #EDE8FF" }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
                  color:"#9CA3AF", marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>Signature Moves</div>
                <p style={{ fontSize:14, color:"#374151", lineHeight:1.7 }}>{profile.signature_moves}</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ padding:"14px 16px", background:"#F6FFED", border:"1px solid #B7EB8F", borderRadius:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#389E0D", letterSpacing:"0.08em",
                    textTransform:"uppercase", marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>✓ Sounds like you</div>
                  <p style={{ fontSize:13, color:"#374151", lineHeight:1.6, fontStyle:"italic" }}>"{profile.what_good_looks_like}"</p>
                </div>
                <div style={{ padding:"14px 16px", background:"#FFF1F0", border:"1px solid #FFCCC7", borderRadius:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#CF1322", letterSpacing:"0.08em",
                    textTransform:"uppercase", marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>✗ Doesn't sound like you</div>
                  <p style={{ fontSize:13, color:"#374151", lineHeight:1.6, fontStyle:"italic" }}>"{profile.what_bad_looks_like}"</p>
                </div>
              </div>
            </div>}
            {tab==="vocabulary" && <div style={{ animation:"slideUp 0.2s ease" }}>
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
                  color:"#389E0D", marginBottom:10, fontFamily:"'JetBrains Mono',monospace" }}>Words you reach for</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {(profile.vocabulary?.reach_for||[]).map((w,i)=>(
                    <span key={i} style={{ padding:"5px 12px", background:"#F6FFED", border:"1px solid #B7EB8F",
                      borderRadius:100, fontSize:13, color:"#389E0D", fontFamily:"'JetBrains Mono',monospace" }}>{w}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
                  color:"#CF1322", marginBottom:10, fontFamily:"'JetBrains Mono',monospace" }}>Words you'd never use</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {(profile.vocabulary?.never_use||[]).map((w,i)=>(
                    <span key={i} style={{ padding:"5px 12px", background:"#FFF1F0", border:"1px solid #FFCCC7",
                      borderRadius:100, fontSize:13, color:"#CF1322", fontFamily:"'JetBrains Mono',monospace" }}>{w}</span>
                  ))}
                </div>
              </div>
            </div>}
            {tab==="prompt" && <div style={{ animation:"slideUp 0.2s ease" }}>
              <div style={{ background:"#1A1A2E", borderRadius:14, padding:22, position:"relative" }}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.12em",
                  textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:12 }}>System Prompt — paste into any AI tool</div>
                <button onClick={()=>{navigator.clipboard.writeText(profile.system_prompt);setCopied(true);setTimeout(()=>setCopied(false),2000)}}
                  style={{ position:"absolute", top:18, right:18, padding:"6px 14px",
                    background:copied?"#10B981":"rgba(255,255,255,0.1)",
                    border:`1px solid ${copied?"transparent":"rgba(255,255,255,0.15)"}`,
                    borderRadius:8, fontSize:11, fontWeight:700,
                    color:copied?"white":"rgba(255,255,255,0.6)", cursor:"pointer",
                    fontFamily:"'Poppins',sans-serif", transition:"all 0.2s" }}>
                  {copied?"✓ Copied":"Copy"}
                </button>
                <pre style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                  color:"rgba(255,255,255,0.7)", lineHeight:1.85, whiteSpace:"pre-wrap",
                  wordBreak:"break-word", maxHeight:280, overflow:"auto" }}>{profile.system_prompt}</pre>
              </div>
            </div>}
          </div>
        </div>

        <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:24,
          opacity:show?1:0, transition:"opacity 0.5s ease 0.5s" }}>
          <button onClick={()=>onSave({...profile, emoji})}
            style={{ padding:"13px 32px", background:"#7C5CFC", color:"white", border:"none",
              borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer",
              fontFamily:"'Poppins',sans-serif", boxShadow:"0 4px 20px rgba(124,92,252,0.3)" }}>
            Save this voice →
          </button>
          <button onClick={onRetry}
            style={{ padding:"13px 24px", background:"transparent", color:"#6B7280",
              border:"1.5px solid #E5E7EB", borderRadius:12, fontSize:14, fontWeight:500,
              cursor:"pointer", fontFamily:"'Poppins',sans-serif" }}>Try again</button>
        </div>
      </div>
    </div>
  );
}


// ── TYPE PICKER + OPTIONAL URL RESEARCH ──────────────────────────────────────
function TypePicker({ onPick, onCancel }) {
  const [step, setStep] = useState("type"); // type | url | researching
  const [selectedType, setSelectedType] = useState(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  const LOADING_MSGS = [
    "Scanning your website...",
    "Reading your competitors...",
    "Mining customer reviews...",
    "Checking Reddit...",
    "Checking AI perception...",
    "Synthesizing findings...",
  ];

  useEffect(() => {
    if (step !== "researching") return;
    const t = setInterval(() => setLoadingStep(s => (s + 1) % LOADING_MSGS.length), 2600);
    return () => clearInterval(t);
  }, [step]);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    if (type === "brand") setStep("url");
    else onPick(type, null);
  };

  const handleURLSubmit = async (skip = false) => {
    if (skip || !url.trim()) { onPick(selectedType, null); return; }
    setStep("researching"); setError("");
    try {
      const domain = url.replace(/https?:\/\/(www\.)?/, "").split("/")[0];
      const text = await callAPI(
        [{ role: "user", content: `Research this brand: ${url.startsWith("http") ? url : "https://" + url}\nDomain: ${domain}\nSearch for: "${domain} reviews", "${domain} site:reddit.com", "${domain} vs competitors", "what is ${domain}". Then return the JSON brand intelligence report.` }],
        BRAND_RESEARCH_SYSTEM, 1500, true
      );
      const clean = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
      const data = JSON.parse(clean);
      onPick(selectedType, data);
    } catch(e) {
      setError("Research failed — " + e.message + ". Skipping to conversation.");
      setTimeout(() => onPick(selectedType, null), 1500);
    }
  };

  const typeCards = [
    { id: "brand", icon: "⬡", label: "Brand Voice", desc: "Your company's personality and tone", color: "#7C5CFC", bg: "#F0EBFF" },
    { id: "founder", icon: "◈", label: "Founder Voice", desc: "Your authentic personal style", color: "#F59E0B", bg: "#FEF3C7" },
    { id: "product", icon: "⬢", label: "Product Voice", desc: "A specific product's positioning", color: "#0EA5E9", bg: "#E0F4FF" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFF", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "40px 24px", fontFamily: "'Poppins',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scanLine{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
        .type-card-pick:hover{border-color:var(--c)!important;background:var(--bg)!important;transform:translateY(-2px)}
      `}</style>

      {step === "type" && (
        <div style={{ maxWidth: 560, width: "100%", animation: "fadeUp 0.4s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ marginBottom: 32 }}><Logo/></div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.02em",
              marginBottom: 10 }}>What kind of voice are you creating?</h2>
            <p style={{ fontSize: 15, color: "#9CA3AF", lineHeight: 1.6 }}>
              Each type gets a different discovery process.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {typeCards.map(t => (
              <div key={t.id} className="type-card-pick"
                style={{ "--c": t.color, "--bg": t.bg,
                  padding: "18px 22px", background: "white", border: "1.5px solid #EDE8FF",
                  borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center",
                  gap: 16, transition: "all 0.18s" }}
                onClick={() => handleTypeSelect(t.id)}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: t.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, flexShrink: 0 }}>{t.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1A1A2E",
                    marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>{t.desc}</div>
                </div>
                <div style={{ marginLeft: "auto", color: "#C4B5FD", fontSize: 18 }}>→</div>
              </div>
            ))}
          </div>
          <button onClick={onCancel} style={{ width: "100%", padding: "12px", background: "transparent",
            border: "none", color: "#9CA3AF", fontSize: 14, cursor: "pointer",
            fontFamily: "'Poppins',sans-serif" }}>← Back to dashboard</button>
        </div>
      )}

      {step === "url" && (
        <div style={{ maxWidth: 520, width: "100%", animation: "fadeUp 0.4s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ width: 56, height: 56, background: "#F0EBFF", borderRadius: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, margin: "0 auto 20px" }}>⬡</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.02em",
              marginBottom: 10 }}>Got a website?</h2>
            <p style={{ fontSize: 15, color: "#9CA3AF", lineHeight: 1.65, maxWidth: 380, margin: "0 auto" }}>
              We'll research your brand before the conversation — reviews, competitors, Reddit, AI perception.
              The questions will be sharper. The surprises will be real.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <input value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleURLSubmit()}
              placeholder="yourcompany.com"
              style={{ flex: 1, padding: "13px 16px", background: "white",
                border: "1.5px solid #EDE8FF", borderRadius: 10, fontSize: 15,
                color: "#1A1A2E", outline: "none", fontFamily: "'Poppins',sans-serif",
                transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = "#7C5CFC"}
              onBlur={e => e.target.style.borderColor = "#EDE8FF"}/>
            <button onClick={() => handleURLSubmit()} disabled={!url.trim()}
              style={{ padding: "13px 22px", background: url.trim() ? "#7C5CFC" : "#E5E7EB",
                color: url.trim() ? "white" : "#9CA3AF", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: url.trim() ? "pointer" : "not-allowed",
                fontFamily: "'Poppins',sans-serif", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              Research →
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8,
            fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>}
          <button onClick={() => handleURLSubmit(true)}
            style={{ width: "100%", padding: "12px", background: "transparent", border: "none",
              color: "#9CA3AF", fontSize: 14, cursor: "pointer",
              fontFamily: "'Poppins',sans-serif" }}>
            Skip — just start the conversation →
          </button>
        </div>
      )}

      {step === "researching" && (
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center",
          animation: "fadeUp 0.4s ease" }}>
          <div style={{ width: 80, height: 80, background: "#F0EBFF", borderRadius: 22,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, margin: "0 auto 28px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, width: 20,
              background: "linear-gradient(90deg, transparent, rgba(124,92,252,0.3), transparent)",
              animation: "scanLine 1.5s ease infinite" }}/>
            ⬡
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1A1A2E", marginBottom: 10,
            letterSpacing: "-0.01em" }}>Researching your brand...</h2>
          <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 28 }}>
            {LOADING_MSGS[loadingStep]}
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {LOADING_MSGS.map((_, i) => (
              <div key={i} style={{ width: i === loadingStep ? 20 : 7, height: 7,
                borderRadius: 4, background: i === loadingStep ? "#7C5CFC" : "#EDE8FF",
                transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}/>
            ))}
          </div>
          <p style={{ marginTop: 24, fontSize: 12, color: "#C4B5FD",
            fontFamily: "'JetBrains Mono',monospace" }}>~30 seconds</p>
        </div>
      )}
    </div>
  );
}

// ── VOICE DISCOVERY CHAT ──────────────────────────────────────────────────────
function VoiceDiscovery({ onVoiceSaved, onCancel, voiceType = null, brandResearch = null }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef();
  const inputRef = useRef();
  const recognitionRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);
  useEffect(() => { if (started && !loading && inputRef.current) inputRef.current.focus(); }, [started, loading, messages]);

  const toggleRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Voice input not supported — please type."); return; }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
    } else {
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = "en-US";
      let final = "";
      r.onstart = () => { setRecording(true); setInput(""); final = ""; };
      r.onend = () => setRecording(false);
      r.onerror = () => { setRecording(false); setError("Mic error — please type."); };
      r.onresult = e => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
          else interim = e.results[i][0].transcript;
        }
        setInput((final + interim).trim());
      };
      recognitionRef.current = r;
      r.start();
    }
  };

  const start = async () => {
    setStarted(true); setLoading(true); setError("");
    try {
      const typeHint = voiceType ? `This is a ${voiceType} voice discovery.` : "";
      const researchHint = brandResearch
        ? `BRAND RESEARCH CONTEXT:
- Category: ${brandResearch.category}
- What they say: ${brandResearch.what_they_say}
- What internet says: ${brandResearch.what_others_say}
- Voice gaps: ${brandResearch.voice_gaps?.join(", ")}
- Start with this question: ${brandResearch.first_question}`
        : "";
      const openingPrompt = researchHint
        ? `Start the voice discovery conversation. ${typeHint} ${researchHint}. Ask the first_question above directly.`
        : `Start the voice discovery conversation with your opening question. ${typeHint}`;
      const system = researchHint
        ? INTERVIEWER_SYSTEM + `

BRAND RESEARCH ALREADY DONE:
${researchHint}
Use this to ask sharper, more specific questions. Reference what you found.`
        : INTERVIEWER_SYSTEM;
      const text = await callAPI([{ role:"user", content: openingPrompt }], system);
      setMessages([{ role:"assistant", content:text }]);
    } catch(e) { setError(e.message); setStarted(false); }
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    if (recording) { recognitionRef.current?.stop(); setRecording(false); }
    const userMsg = { role:"user", content:input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true); setError("");
    try {
      const enrichedSystem = brandResearch
        ? INTERVIEWER_SYSTEM + `\n\nBRAND RESEARCH CONTEXT: Category: ${brandResearch.category}. Gap: ${brandResearch.voice_gaps?.join(", ")}. Use this to ask sharper questions.`
        : INTERVIEWER_SYSTEM;
      const text = await callAPI(newMsgs, enrichedSystem);
      try {
        const clean = text.replace(/```json|```/gi,"").trim();
        const parsed = JSON.parse(clean);
        if (parsed.done) { setLoading(false); analyze(newMsgs); return; }
      } catch {}
      setMessages([...newMsgs, { role:"assistant", content:text }]);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const analyze = async (convMsgs) => {
    setAnalyzing(true);
    setMessages(prev => [...prev, { role:"assistant", content:"I've heard enough. Building your voice profile now...", isFinal:true }]);
    const transcript = convMsgs.map(m=>`${m.role==="user"?"THEM":"INTERVIEWER"}: ${m.content}`).join("\n\n");
    try {
      const text = await callAPI(
        [{ role:"user", content:`Here is the voice discovery conversation:\n\n${transcript}\n\nAnalyze their voice and return only the JSON profile.` }],
        ANALYZER_SYSTEM, 1500
      );
      const clean = text.replace(/```json|```/g,"").trim();
      setProfile(JSON.parse(clean));
    } catch(e) { setError("Couldn't build the profile — " + e.message); }
    setAnalyzing(false);
  };

  if (profile) return <VoiceReveal profile={profile} onSave={v=>{onVoiceSaved(v);setProfile(null);}} onRetry={()=>{setProfile(null);setMessages([]);setStarted(false);}}/>;

  if (!started) return (
    <div style={{ minHeight:"100vh", background:"#FAFBFF", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:"40px 24px", fontFamily:"'Poppins',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');.start-btn:hover{transform:translateY(-2px)!important;box-shadow:0 12px 40px rgba(124,92,252,0.4)!important}`}</style>
      <div style={{ maxWidth:560, textAlign:"center" }}>
        <div style={{ marginBottom:48 }}><Logo/></div>
        <div style={{ fontSize:13, fontWeight:600, color:"#7C5CFC", letterSpacing:"0.08em",
          textTransform:"uppercase", marginBottom:8 }}>Voice Discovery</div>
        <div style={{ fontSize:10, color:"#C4B5FD", fontFamily:"monospace", marginBottom:20 }}>v2.5 · type picker + research</div>
        <h1 style={{ fontSize:42, fontWeight:800, color:"#1A1A2E", letterSpacing:"-0.03em",
          lineHeight:1.1, marginBottom:20 }}>We find your voice.<br/><span style={{ color:"#7C5CFC" }}>You just talk.</span></h1>
        <p style={{ fontSize:16, color:"#6B7280", lineHeight:1.75, marginBottom:40, maxWidth:420, margin:"0 auto 40px" }}>
          No sliders. No forms. No "describe your tone in three adjectives." Just a real conversation.
        </p>
        <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap", marginBottom:48 }}>
          {["5–7 questions","~10 minutes","Fully AI-powered"].map(t=>(
            <div key={t} style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 16px",
              background:"white", border:"1px solid #EDE8FF", borderRadius:100, fontSize:13, color:"#6B7280" }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#7C5CFC" }}/>{t}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button className="start-btn" onClick={start} style={{ padding:"16px 48px", background:"#7C5CFC",
            color:"white", border:"none", borderRadius:14, fontSize:17, fontWeight:700,
            cursor:"pointer", fontFamily:"'Poppins',sans-serif",
            boxShadow:"0 8px 32px rgba(124,92,252,0.3)", transition:"all 0.2s" }}>
            Discover my voice →
          </button>
          {onCancel && <button onClick={onCancel} style={{ padding:"16px 24px", background:"transparent",
            color:"#9CA3AF", border:"1.5px solid #E5E7EB", borderRadius:14, fontSize:15,
            cursor:"pointer", fontFamily:"'Poppins',sans-serif" }}>← Back</button>}
        </div>
        {error && <div style={{ marginTop:16, color:"#EF4444", fontSize:13 }}>{error}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#FAFBFF", display:"flex", flexDirection:"column", fontFamily:"'Poppins',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
        @keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 3px rgba(239,68,68,0.2)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0.05)}}
      `}</style>
      <div style={{ padding:"16px 24px", borderBottom:"1px solid #EDE8FF", background:"white",
        display:"flex", alignItems:"center", gap:12 }}>
        <Logo size={90}/>
        <div style={{ width:1, height:20, background:"#EDE8FF" }}/>
        <div style={{ fontSize:12, color:"#9CA3AF" }}>Voice Discovery</div>
        {analyzing ? (
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8,
            fontSize:12, color:"#7C5CFC", fontWeight:600 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#7C5CFC", animation:"pulse 1s infinite" }}/>
            Building your voice profile...
          </div>
        ) : (
          <div style={{ marginLeft:"auto", display:"flex", gap:5, alignItems:"center" }}>
            {Array.from({length:7}).map((_,i)=>{
              const n = messages.filter(m=>m.role==="user").length;
              return <div key={i} style={{ width:i<n?20:7, height:7, borderRadius:4,
                background:i<n?"#7C5CFC":"#EDE8FF", transition:"all 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}/>;
            })}
          </div>
        )}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"32px 24px", maxWidth:680, width:"100%", margin:"0 auto" }}>
        {messages.map((m,i)=>(
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start",
            marginBottom:20, animation:"msgIn 0.3s ease" }}>
            {m.role==="assistant" && <div style={{ width:32, height:32, borderRadius:10, background:"#F0EBFF",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, marginRight:10, flexShrink:0, marginTop:2 }}>✨</div>}
            <div style={{ maxWidth:"72%", padding:"12px 18px",
              borderRadius:m.role==="user"?"18px 18px 4px 18px":"4px 18px 18px 18px",
              background:m.role==="user"?"#7C5CFC":"white", color:m.role==="user"?"white":"#1A1A2E",
              fontSize:15, lineHeight:1.65,
              border:m.role==="assistant"?"1px solid #EDE8FF":"none",
              boxShadow:m.role==="assistant"?"0 2px 12px rgba(124,92,252,0.06)":"none",
              fontStyle:m.isFinal?"italic":"normal" }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ display:"flex", marginBottom:20 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:"#F0EBFF", display:"flex",
            alignItems:"center", justifyContent:"center", fontSize:16, marginRight:10, flexShrink:0 }}>✨</div>
          <div style={{ padding:"14px 18px", background:"white", borderRadius:"4px 18px 18px 18px",
            border:"1px solid #EDE8FF", boxShadow:"0 2px 12px rgba(124,92,252,0.06)" }}><TypingDots/></div>
        </div>}
        <div ref={bottomRef}/>
      </div>
      {!analyzing && (
        <div style={{ padding:"16px 24px", borderTop:"1px solid #EDE8FF", background:"white" }}>
          <div style={{ maxWidth:680, margin:"0 auto", display:"flex", gap:10 }}>
            <button onClick={toggleRecording} disabled={loading} style={{ width:50, height:50,
              borderRadius:14, border:"none", flexShrink:0, fontSize:20, cursor:loading?"not-allowed":"pointer",
              background:recording?"#FEE2E2":"#F8F5FF", color:recording?"#EF4444":"#A78BFA",
              display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s",
              animation:recording?"micPulse 1.5s ease infinite":"none" }}>
              {recording?"⏹":"🎙️"}
            </button>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),send())}
              placeholder={recording?"Listening… tap ⏹ when done":"Type or tap 🎙️ to speak…"}
              disabled={loading} style={{ flex:1, padding:"13px 18px",
                border:`1.5px solid ${recording?"#FCA5A5":"#EDE8FF"}`,
                borderRadius:12, fontSize:15, fontFamily:"'Poppins',sans-serif",
                color:"#1A1A2E", outline:"none", background:recording?"#FFF5F5":"#FAFBFF",
                transition:"all 0.2s" }}
              onFocus={e=>{ if(!recording) e.target.style.borderColor="#7C5CFC"; }}
              onBlur={e=>{ if(!recording) e.target.style.borderColor="#EDE8FF"; }}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{ padding:"13px 22px",
              background:!input.trim()||loading?"#E5E7EB":"#7C5CFC",
              color:!input.trim()||loading?"#9CA3AF":"white", border:"none", borderRadius:12,
              fontSize:15, fontWeight:600, cursor:!input.trim()||loading?"not-allowed":"pointer",
              fontFamily:"'Poppins',sans-serif", transition:"all 0.15s", flexShrink:0 }}>Send →</button>
          </div>
          {error && <div style={{ maxWidth:680, margin:"8px auto 0", color:"#EF4444", fontSize:12 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

// ── VOICE EDITOR ──────────────────────────────────────────────────────────────
function VoiceEditor({ voice, onUpdate, onBack }) {
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const meta = TYPE_META[voice.type] || TYPE_META.brand;

  const up = (field, val) => onUpdate({ ...voice, [field]: val, updatedAt: new Date().toISOString() });

  return (
    <div style={{ minHeight:"100vh", background:"#FAFBFF", fontFamily:"'Poppins',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>
      <div style={{ padding:"16px 24px", borderBottom:"1px solid #EDE8FF", background:"white",
        display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={{ padding:"8px 16px", background:"transparent", border:"1.5px solid #EDE8FF",
          borderRadius:8, fontSize:13, color:"#6B7280", cursor:"pointer", fontFamily:"'Poppins',sans-serif" }}>← Voices</button>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <VoiceAvatar voice={voice} size={32}/>
          <div style={{ fontWeight:700, fontSize:15, color:"#1A1A2E" }}>{voice.name}</div>
          <span style={{ padding:"2px 10px", background:meta.bg, color:meta.color, borderRadius:100,
            fontSize:11, fontWeight:600, letterSpacing:"0.04em" }}>{meta.label}</span>
        </div>
      </div>
      <div style={{ maxWidth:680, margin:"0 auto", padding:32 }}>
        <div style={{ display:"flex", gap:8, marginBottom:24, borderBottom:"1px solid #EDE8FF", paddingBottom:16 }}>
          {["overview","tagline","system_prompt"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 16px", border:"none",
              background:tab===t?"#F0EBFF":"transparent", color:tab===t?"#7C5CFC":"#9CA3AF",
              borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Poppins',sans-serif",
              textTransform:"capitalize" }}>{t.replace("_"," ")}</button>
          ))}
        </div>
        {tab==="overview" && <div>
          <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:28, padding:24,
            background:"white", borderRadius:16, border:"1px solid #EDE8FF" }}>
            <VoiceAvatar voice={voice} size={64}/>
            <div style={{ flex:1 }}>
              <input value={voice.name} onChange={e=>up("name",e.target.value)}
                style={{ fontWeight:700, fontSize:20, color:"#1A1A2E", background:"transparent",
                  border:"none", outline:"none", fontFamily:"'Poppins',sans-serif", padding:0, width:"100%" }}/>
              <div style={{ fontSize:13, color:"#9CA3AF", marginTop:4, fontStyle:"italic" }}>
                {voice.tagline || "No tagline yet"}
              </div>
            </div>
          </div>
          {voice.attributes?.length > 0 && <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
              color:"#9CA3AF", marginBottom:10, fontFamily:"'JetBrains Mono',monospace" }}>Voice Attributes</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {voice.attributes.map((a,i)=>(
                <span key={i} style={{ padding:"6px 14px", background:"#F0EBFF", color:"#7C5CFC",
                  borderRadius:100, fontSize:13, fontWeight:500 }}>{a}</span>
              ))}
            </div>
          </div>}
          {voice.vocabulary && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div style={{ padding:16, background:"#F6FFED", border:"1px solid #B7EB8F", borderRadius:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#389E0D", letterSpacing:"0.08em",
                textTransform:"uppercase", marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>Reach for</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {voice.vocabulary.reach_for?.map((w,i)=>(
                  <span key={i} style={{ padding:"3px 9px", background:"white", border:"1px solid #B7EB8F",
                    borderRadius:100, fontSize:12, color:"#389E0D", fontFamily:"'JetBrains Mono',monospace" }}>{w}</span>
                ))}
              </div>
            </div>
            <div style={{ padding:16, background:"#FFF1F0", border:"1px solid #FFCCC7", borderRadius:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#CF1322", letterSpacing:"0.08em",
                textTransform:"uppercase", marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>Never use</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {voice.vocabulary.never_use?.map((w,i)=>(
                  <span key={i} style={{ padding:"3px 9px", background:"white", border:"1px solid #FFCCC7",
                    borderRadius:100, fontSize:12, color:"#CF1322", fontFamily:"'JetBrains Mono',monospace" }}>{w}</span>
                ))}
              </div>
            </div>
          </div>}
        </div>}
        {tab==="tagline" && <div>
          <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
            color:"#9CA3AF", marginBottom:8, display:"block", fontFamily:"'JetBrains Mono',monospace" }}>Tagline</label>
          <input value={voice.tagline||""} onChange={e=>up("tagline",e.target.value)}
            placeholder="One sentence this voice would say about itself…"
            style={{ width:"100%", padding:"12px 16px", border:"1.5px solid #EDE8FF", borderRadius:10,
              fontSize:15, fontFamily:"'Poppins',sans-serif", color:"#1A1A2E", outline:"none",
              marginBottom:24 }}/>
          <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
            color:"#9CA3AF", marginBottom:8, display:"block", fontFamily:"'JetBrains Mono',monospace" }}>Sentence Style</label>
          <textarea value={voice.sentence_style||""} onChange={e=>up("sentence_style",e.target.value)} rows={3}
            style={{ width:"100%", padding:"12px 16px", border:"1.5px solid #EDE8FF", borderRadius:10,
              fontSize:14, fontFamily:"'Poppins',sans-serif", color:"#1A1A2E", outline:"none",
              resize:"vertical", marginBottom:24 }}/>
          <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase",
            color:"#9CA3AF", marginBottom:8, display:"block", fontFamily:"'JetBrains Mono',monospace" }}>Signature Moves</label>
          <textarea value={voice.signature_moves||""} onChange={e=>up("signature_moves",e.target.value)} rows={3}
            style={{ width:"100%", padding:"12px 16px", border:"1.5px solid #EDE8FF", borderRadius:10,
              fontSize:14, fontFamily:"'Poppins',sans-serif", color:"#1A1A2E", outline:"none",
              resize:"vertical" }}/>
        </div>}
        {tab==="system_prompt" && <div>
          <div style={{ background:"#1A1A2E", borderRadius:14, padding:22, position:"relative" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.12em",
              textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:12 }}>System Prompt</div>
            <button onClick={()=>{navigator.clipboard.writeText(voice.system_prompt||"");setCopied(true);setTimeout(()=>setCopied(false),2000)}}
              style={{ position:"absolute", top:18, right:18, padding:"6px 14px",
                background:copied?"#10B981":"rgba(255,255,255,0.1)",
                border:`1px solid ${copied?"transparent":"rgba(255,255,255,0.15)"}`,
                borderRadius:8, fontSize:11, fontWeight:700,
                color:copied?"white":"rgba(255,255,255,0.6)", cursor:"pointer",
                fontFamily:"'Poppins',sans-serif", transition:"all 0.2s" }}>
              {copied?"✓ Copied":"Copy"}
            </button>
            <textarea value={voice.system_prompt||""} onChange={e=>up("system_prompt",e.target.value)}
              rows={14} style={{ width:"100%", background:"transparent", border:"none", outline:"none",
                fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"rgba(255,255,255,0.7)",
                lineHeight:1.85, resize:"vertical" }}/>
          </div>
        </div>}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ voices, onNew, onSelect, onDelete, onScore, scoreHistory }) {
  const [activeTab, setActiveTab] = useState("voices");
  const grouped = {
    founder: voices.filter(v=>v.type==="founder"),
    brand:   voices.filter(v=>v.type==="brand"),
    product: voices.filter(v=>v.type==="product"),
  };

  return (
    <div style={{ minHeight:"100vh", background:"#FAFBFF", fontFamily:"'Poppins',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .dash-tab:hover{color:#7C5CFC!important}
      `}</style>

      {/* Header */}
      <div style={{ padding:"16px 32px", borderBottom:"1px solid #EDE8FF", background:"white",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Logo/>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onScore} style={{ padding:"10px 20px", background:"#F0EBFF", color:"#7C5CFC",
            border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer",
            fontFamily:"'Poppins',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
            🎯 Boom Score
          </button>
          <button onClick={onNew} style={{ padding:"10px 20px", background:"#7C5CFC", color:"white",
            border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer",
            fontFamily:"'Poppins',sans-serif", boxShadow:"0 4px 16px rgba(124,92,252,0.3)" }}>
            + New voice
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:"1px solid #EDE8FF", background:"white", padding:"0 32px", display:"flex", gap:0 }}>
        {[
          { id:"voices", label:`Voices (${voices.length})` },
          { id:"scores", label:`Score history (${scoreHistory.length})` },
        ].map(t => (
          <button key={t.id} className="dash-tab" onClick={()=>setActiveTab(t.id)}
            style={{ padding:"12px 16px", border:"none", background:"transparent",
              fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:600,
              cursor:"pointer", color:activeTab===t.id?"#7C5CFC":"#9CA3AF",
              borderBottom:`2.5px solid ${activeTab===t.id?"#7C5CFC":"transparent"}`,
              transition:"all 0.15s" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth:880, margin:"0 auto", padding:"32px 32px" }}>

        {/* Score history tab */}
        {activeTab === "scores" && (
          <div>
            {scoreHistory.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 40px" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🎯</div>
                <div style={{ fontSize:20, fontWeight:700, color:"#1A1A2E", marginBottom:8 }}>No scores yet</div>
                <div style={{ fontSize:14, color:"#9CA3AF", marginBottom:24 }}>
                  Score any URL or content to see how strong the brand voice is.
                </div>
                <button onClick={onScore} style={{ padding:"12px 28px", background:"#7C5CFC", color:"white",
                  border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer",
                  fontFamily:"'Poppins',sans-serif" }}>
                  Score something →
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:"#9CA3AF",
                    textTransform:"uppercase", letterSpacing:"0.08em" }}>Recent scores</div>
                  <button onClick={onScore} style={{ padding:"8px 16px", background:"#7C5CFC", color:"white",
                    border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
                    fontFamily:"'Poppins',sans-serif" }}>+ New score</button>
                </div>
                {scoreHistory.map((entry, i) => (
                  <ScoreHistoryCard key={i} entry={entry} onView={() => {}} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Voices tab */}
        {activeTab === "voices" && (
        <>
        {voices.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 40px" }}>
            <div style={{ fontSize:56, marginBottom:20 }}>🚀</div>
            <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:28, fontWeight:800,
              color:"#1A1A2E", marginBottom:12, letterSpacing:"-0.02em" }}>No voices yet</div>
            <div style={{ fontSize:15, color:"#9CA3AF", marginBottom:32, lineHeight:1.7 }}>
              Discover your first voice — just have a conversation.
            </div>
            <button onClick={onNew} style={{ padding:"14px 36px", background:"#7C5CFC", color:"white",
              border:"none", borderRadius:12, fontSize:16, fontWeight:700, cursor:"pointer",
              fontFamily:"'Poppins',sans-serif", boxShadow:"0 4px 20px rgba(124,92,252,0.3)" }}>
              Discover my voice →
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([type, list]) => list.length > 0 && (
            <div key={type} style={{ marginBottom:40 }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                color:"#9CA3AF", marginBottom:16, fontFamily:"'JetBrains Mono',monospace",
                display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:TYPE_META[type]?.color, display:"inline-block" }}/>
                {TYPE_META[type]?.label}s
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:16 }}>
                {list.map(v => (
                  <div key={v.id} style={{ background:"white", border:"1px solid #EDE8FF", borderRadius:16,
                    padding:20, cursor:"pointer", transition:"all 0.2s",
                    boxShadow:"0 2px 8px rgba(124,92,252,0.04)" }}
                    onClick={()=>onSelect(v)}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 8px 32px rgba(124,92,252,0.12)";e.currentTarget.style.borderColor="#C4B5FD";}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 8px rgba(124,92,252,0.04)";e.currentTarget.style.borderColor="#EDE8FF";}}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                      <VoiceAvatar voice={v} size={44}/>
                      <button onClick={e=>{e.stopPropagation();if(window.confirm(`Delete "${v.name}"?`))onDelete(v.id)}}
                        style={{ background:"none", border:"none", fontSize:16, cursor:"pointer",
                          color:"#D1D5DB", padding:4, lineHeight:1 }}
                        onMouseEnter={e=>e.target.style.color="#EF4444"}
                        onMouseLeave={e=>e.target.style.color="#D1D5DB"}>🗑</button>
                    </div>
                    <div style={{ fontWeight:700, fontSize:15, color:"#1A1A2E", marginBottom:4,
                      letterSpacing:"-0.01em" }}>{v.name}</div>
                    {v.tagline && <div style={{ fontSize:12, color:"#9CA3AF", lineHeight:1.5,
                      fontStyle:"italic", marginBottom:10 }}>"{v.tagline}"</div>}
                    {v.attributes?.length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8 }}>
                        {v.attributes.slice(0,3).map((a,i)=>(
                          <span key={i} style={{ padding:"3px 10px", background:TYPE_META[v.type]?.bg,
                            color:TYPE_META[v.type]?.color, borderRadius:100, fontSize:11, fontWeight:500 }}>{a}</span>
                        ))}
                        {v.attributes.length > 3 && <span style={{ padding:"3px 10px", background:"#F5F5F5",
                          color:"#9CA3AF", borderRadius:100, fontSize:11 }}>+{v.attributes.length-3}</span>}
                      </div>
                    )}
                    <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #F0EEFF",
                      fontSize:11, color:"#C4B5FD", fontFamily:"'JetBrains Mono',monospace" }}>
                      Updated {v.updatedAt?.slice(0,10) || "today"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        </>
        )}

      </div>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [voices, setVoices] = useState(() => loadVoices());
  const [view, setView] = useState("dashboard");
  const [editing, setEditing] = useState(null);
  const [pickedType, setPickedType] = useState(null);
  const [research, setResearch] = useState(null);

  // ── Boom Score state ──────────────────────────────────────────────────────
  const [scoreHistory, setScoreHistory] = useState(() => loadScoreHistory());
  const [scoreInputMeta, setScoreInputMeta] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreLoadingMeta, setScoreLoadingMeta] = useState(null);

  const persist = (v) => { setVoices(v); saveVoices(v); };

  const handleSaved = (profile) => {
    const voice = {
      id: makeId(),
      name: profile.name || "My Voice",
      type: profile.type || "founder",
      emoji: profile.emoji || "🚀",
      tagline: profile.tagline || "",
      attributes: profile.attributes || [],
      vocabulary: profile.vocabulary || {},
      sentence_style: profile.sentence_style || "",
      signature_moves: profile.signature_moves || "",
      what_good_looks_like: profile.what_good_looks_like || "",
      what_bad_looks_like: profile.what_bad_looks_like || "",
      system_prompt: profile.system_prompt || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persist([...voices, voice]);
    setView("dashboard");
  };

  const handleUpdate = (updated) => {
    const next = voices.map(v => v.id === updated.id ? updated : v);
    persist(next);
    setEditing(updated);
  };

  const handleDelete = (id) => {
    persist(voices.filter(v => v.id !== id));
  };

  // ── Boom Score handlers ───────────────────────────────────────────────────
  const handleScore = async (inputMeta) => {
    setScoreInputMeta(inputMeta);
    setScoreLoadingMeta({ mode: inputMeta.mode, url: inputMeta.url });
    setView("score-loading");

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inputMeta),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Scoring failed");
      }
      // Save to history
      const next = [data, ...scoreHistory];
      setScoreHistory(next);
      saveScoreHistory(next);
      setScoreResult(data);
      setView("score-results");
    } catch (e) {
      setView("score-entry");
      throw e;
    }
  };

  // ── Routing ───────────────────────────────────────────────────────────────
  if (view === "discover") return <TypePicker onPick={(type, research) => { setPickedType(type); setResearch(research); setView("chat"); }} onCancel={()=>setView("dashboard")}/>;
  if (view === "chat") return <VoiceDiscovery onVoiceSaved={handleSaved} onCancel={()=>setView("dashboard")} voiceType={pickedType} brandResearch={research}/>;
  if (view === "editor" && editing) return <VoiceEditor voice={editing} onUpdate={handleUpdate} onBack={()=>setView("dashboard")}/>;

  if (view === "score-entry") return (
    <BoomScoreEntry
      voices={voices}
      onScore={handleScore}
      onCancel={() => setView("dashboard")}
    />
  );

  if (view === "score-loading") return (
    <BoomScoreLoading
      mode={scoreLoadingMeta?.mode}
      url={scoreLoadingMeta?.url}
    />
  );

  if (view === "score-results" && scoreResult) return (
    <BoomScoreResults
      result={scoreResult}
      inputMeta={scoreInputMeta}
      onRescore={() => setView("score-entry")}
      onBack={() => setView("dashboard")}
      onBuildVoice={() => setView("discover")}
    />
  );

  return (
    <Dashboard
      voices={voices}
      onNew={() => setView("discover")}
      onSelect={v => { setEditing(v); setView("editor"); }}
      onDelete={handleDelete}
      onScore={() => setView("score-entry")}
      scoreHistory={scoreHistory}
    />
  );
}
