import { useState, useRef, useEffect } from "react";

// ── STORAGE ───────────────────────────────────────────────────────────────────
const SCORE_STORAGE_KEY = "boomscore_history_v1";
function loadScoreHistory() {
  try { const r = localStorage.getItem(SCORE_STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveScoreHistory(history) {
  try { localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(history.slice(0, 20))); } catch {}
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function gradeColor(grade) {
  if (!grade) return "#9CA3AF";
  if (grade === "A") return "#10B981";
  if (grade === "B+" || grade === "B") return "#7C5CFC";
  if (grade === "B-" || grade === "C+") return "#F59E0B";
  if (grade === "C") return "#F97316";
  return "#EF4444";
}

function gradeBg(grade) {
  if (!grade) return "#F5F5F5";
  if (grade === "A") return "#F0FDF4";
  if (grade === "B+" || grade === "B") return "#F0EBFF";
  if (grade === "B-" || grade === "C+") return "#FEF3C7";
  if (grade === "C") return "#FFF4ED";
  return "#FFF1F0";
}

function verdictColor(v) {
  if (v === "PASS") return "#10B981";
  if (v === "PARTIAL") return "#F59E0B";
  return "#EF4444";
}

function verdictBg(v) {
  if (v === "PASS") return "#F0FDF4";
  if (v === "PARTIAL") return "#FEF3C7";
  return "#FFF1F0";
}

function ScoreBar({ score, max, color }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div style={{ height: 6, background: "#EDE8FF", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3,
        transition: "width 1s cubic-bezier(0.34,1.56,0.64,1)" }} />
    </div>
  );
}

function AnimatedScore({ target }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame;
    let start = null;
    const duration = 1200;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return display;
}

// ── BOOM SCORE ENTRY ─────────────────────────────────────────────────────────
export function BoomScoreEntry({ voices, onScore, onCancel }) {
  const [mode, setMode] = useState("url");
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = mode === "url" ? url.trim().length > 0 : paste.trim().length > 50;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      await onScore({
        mode,
        url: mode === "url" ? url.trim() : null,
        pastedContent: mode === "paste" ? paste.trim() : null,
        voiceProfile: selectedVoice,
      });
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFF", fontFamily: "'Poppins',sans-serif",
      display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .mode-tab:hover{background:#F0EBFF!important;color:#7C5CFC!important}
        .voice-chip:hover{border-color:#7C5CFC!important;background:#F0EBFF!important}
        .submit-btn:hover:not(:disabled){background:#6B4EE0!important;transform:translateY(-1px)}
        .submit-btn:disabled{opacity:0.5;cursor:not-allowed}
      `}</style>

      {/* Header */}
      <div style={{ padding: "18px 28px", borderBottom: "1px solid #EDE8FF", background: "white",
        display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onCancel} style={{ background: "transparent", border: "1.5px solid #EDE8FF",
          borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "#6B7280", cursor: "pointer",
          fontFamily: "'Poppins',sans-serif" }}>← Back</button>
        <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#9CA3AF",
          letterSpacing: "0.06em" }}>BOOM SCORE</div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px", width: "100%",
        animation: "fadeUp 0.4s ease" }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.02em",
            marginBottom: 10, lineHeight: 1.2 }}>How strong is your<br/>
            <span style={{ color: "#7C5CFC" }}>brand voice?</span></h1>
          <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7 }}>
            Paste a URL or content. Get a score, a logo removal verdict, and your highest-impact fixes.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "#F0EBFF", borderRadius: 12, padding: 4,
          marginBottom: 20, gap: 4 }}>
          {[
            { id: "url", icon: "🔗", label: "URL" },
            { id: "paste", icon: "📋", label: "Paste content" },
          ].map(m => (
            <button key={m.id} className="mode-tab" onClick={() => setMode(m.id)}
              style={{ flex: 1, padding: "10px 16px", border: "none", borderRadius: 9,
                background: mode === m.id ? "white" : "transparent",
                color: mode === m.id ? "#7C5CFC" : "#9CA3AF",
                fontWeight: mode === m.id ? 700 : 500, fontSize: 13,
                cursor: "pointer", fontFamily: "'Poppins',sans-serif",
                boxShadow: mode === m.id ? "0 2px 8px rgba(124,92,252,0.12)" : "none",
                transition: "all 0.15s", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6 }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ marginBottom: 20 }}>
          {mode === "url" ? (
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="https://yoursite.com/page"
                style={{ flex: 1, padding: "13px 16px", border: "1.5px solid #EDE8FF",
                  borderRadius: 10, fontSize: 14, fontFamily: "'Poppins',sans-serif",
                  color: "#1A1A2E", outline: "none", background: "white", transition: "border 0.2s" }}
                onFocus={e => e.target.style.borderColor = "#7C5CFC"}
                onBlur={e => e.target.style.borderColor = "#EDE8FF"}
              />
              <button className="submit-btn" onClick={handleSubmit} disabled={!canSubmit || loading}
                style={{ padding: "13px 22px", background: "#7C5CFC", color: "white", border: "none",
                  borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'Poppins',sans-serif", transition: "all 0.15s", whiteSpace: "nowrap",
                  boxShadow: "0 4px 16px rgba(124,92,252,0.3)" }}>
                {loading ? "Scoring..." : "Score it →"}
              </button>
            </div>
          ) : (
            <div>
              <textarea
                value={paste}
                onChange={e => setPaste(e.target.value)}
                placeholder="Paste any content — homepage copy, a blog post, email, LinkedIn post, product page..."
                rows={8}
                style={{ width: "100%", padding: "13px 16px", border: "1.5px solid #EDE8FF",
                  borderRadius: 10, fontSize: 13, fontFamily: "'Poppins',sans-serif",
                  color: "#1A1A2E", outline: "none", background: "white", resize: "vertical",
                  transition: "border 0.2s", lineHeight: 1.65 }}
                onFocus={e => e.target.style.borderColor = "#7C5CFC"}
                onBlur={e => e.target.style.borderColor = "#EDE8FF"}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                marginTop: 10 }}>
                <span style={{ fontSize: 11, color: "#C4B5FD", fontFamily: "'JetBrains Mono',monospace" }}>
                  {paste.length} chars {paste.length < 50 && paste.length > 0 ? "— add more content for a reliable score" : ""}
                </span>
                <button className="submit-btn" onClick={handleSubmit} disabled={!canSubmit || loading}
                  style={{ padding: "11px 22px", background: "#7C5CFC", color: "white", border: "none",
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "'Poppins',sans-serif", transition: "all 0.15s",
                    boxShadow: "0 4px 16px rgba(124,92,252,0.3)" }}>
                  {loading ? "Scoring..." : "Score it →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Voice selector */}
        {voices.length > 0 && (
          <div style={{ background: "white", border: "1px solid #EDE8FF", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "#9CA3AF", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>
              Score against a Boom Voice (optional)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button className="voice-chip" onClick={() => setSelectedVoice(null)}
                style={{ padding: "7px 14px", border: `1.5px solid ${!selectedVoice ? "#7C5CFC" : "#EDE8FF"}`,
                  borderRadius: 100, fontSize: 12, fontWeight: selectedVoice ? 400 : 600,
                  color: !selectedVoice ? "#7C5CFC" : "#9CA3AF",
                  background: !selectedVoice ? "#F0EBFF" : "white",
                  cursor: "pointer", fontFamily: "'Poppins',sans-serif", transition: "all 0.15s" }}>
                Generic scoring
              </button>
              {voices.map(v => (
                <button key={v.id} className="voice-chip"
                  onClick={() => setSelectedVoice(selectedVoice?.id === v.id ? null : v)}
                  style={{ padding: "7px 14px", border: `1.5px solid ${selectedVoice?.id === v.id ? "#7C5CFC" : "#EDE8FF"}`,
                    borderRadius: 100, fontSize: 12, fontWeight: selectedVoice?.id === v.id ? 600 : 400,
                    color: selectedVoice?.id === v.id ? "#7C5CFC" : "#6B7280",
                    background: selectedVoice?.id === v.id ? "#F0EBFF" : "white",
                    cursor: "pointer", fontFamily: "'Poppins',sans-serif",
                    transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
                  {v.emoji} {v.name}
                </button>
              ))}
            </div>
            {selectedVoice && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#F0EBFF", borderRadius: 8,
                fontSize: 12, color: "#7C5CFC" }}>
                ✓ Scoring against <strong>{selectedVoice.name}</strong> — voice-aware recommendations unlocked
              </div>
            )}
          </div>
        )}

        {voices.length === 0 && (
          <div style={{ padding: "12px 16px", background: "#FAFBFF", border: "1px dashed #EDE8FF",
            borderRadius: 10, fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
            Create a <strong style={{ color: "#7C5CFC" }}>Boom Voice</strong> to unlock voice-aware scoring
            and see exactly which proof points from your brand belong on this page
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#FFF1F0",
            border: "1px solid #FFCCC7", borderRadius: 8, fontSize: 12,
            color: "#EF4444", fontFamily: "'JetBrains Mono',monospace" }}>
            {error}
            {error.includes("JavaScript") && (
              <div style={{ marginTop: 6, color: "#6B7280" }}>
                Try switching to <strong>Paste content</strong> mode — copy the page text and paste it directly.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── BOOM SCORE LOADING ────────────────────────────────────────────────────────
export function BoomScoreLoading({ mode, url }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const msgs = [
    "Reading your content...",
    "Applying the logo removal test...",
    "Scoring five voice dimensions...",
    "Finding your biggest opportunity...",
    "Almost there...",
  ];
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFF", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", fontFamily: "'Poppins',sans-serif", gap: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes scanLine{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
      `}</style>
      <div style={{ width: 80, height: 80, background: "#F0EBFF", borderRadius: 22,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
        position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0,
          background: "linear-gradient(90deg,transparent,rgba(124,92,252,0.25),transparent)",
          animation: "scanLine 1.5s ease infinite" }} />
        🎯
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 20, color: "#1A1A2E", marginBottom: 8 }}>
          Scoring brand voice...
        </div>
        {mode === "url" && url && (
          <div style={{ fontSize: 12, color: "#9CA3AF", fontFamily: "'JetBrains Mono',monospace",
            marginBottom: 12 }}>{url.replace(/^https?:\/\//, "").slice(0, 50)}</div>
        )}
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>{msgs[msgIdx]}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {msgs.map((_, i) => (
          <div key={i} style={{ width: i === msgIdx ? 20 : 7, height: 7, borderRadius: 4,
            background: i === msgIdx ? "#7C5CFC" : "#EDE8FF",
            transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#C4B5FD", fontFamily: "'JetBrains Mono',monospace" }}>
        ~15 seconds
      </div>
    </div>
  );
}

// ── BOOM SCORE RESULTS ────────────────────────────────────────────────────────
export function BoomScoreResults({ result, inputMeta, onRescore, onBack, onBuildVoice }) {
  const [show, setShow] = useState(false);
  const [tab, setTab] = useState("overview");
  useEffect(() => { setTimeout(() => setShow(true), 80); }, []);

  const { overall_score, grade, logo_removal_verdict, logo_removal_explanation,
    dimensions, fix_now, missed_opportunity, boom_voice_preview,
    content_type_inferred, brand_type_inferred, scoring_mode, _meta } = result;

  const gc = gradeColor(grade);
  const gBg = gradeBg(grade);

  const dimList = [
    { key: "pov_strength", label: "POV Strength", max: 25 },
    { key: "specificity", label: "Specificity", max: 20 },
    { key: "language_distinctiveness", label: "Language Distinctiveness", max: 20 },
    { key: "confidence", label: "Confidence", max: 20 },
    { key: "structure", label: "Structure", max: 15 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFF", fontFamily: "'Poppins',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scoreIn{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}
        .fix-card:hover{border-color:#C4B5FD!important;box-shadow:0 4px 16px rgba(124,92,252,0.08)!important}
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid #EDE8FF", background: "white",
        display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky",
        top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "transparent", border: "1.5px solid #EDE8FF",
            borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "#6B7280", cursor: "pointer",
            fontFamily: "'Poppins',sans-serif" }}>← New score</button>
          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#9CA3AF" }}>
            {_meta?.url ? _meta.url.replace(/^https?:\/\//, "").slice(0, 45) : "Pasted content"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {scoring_mode === "generic" && boom_voice_preview && (
            <button onClick={onBuildVoice}
              style={{ padding: "8px 16px", background: "#F0EBFF", color: "#7C5CFC", border: "none",
                borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "'Poppins',sans-serif" }}>
              ✨ Add Boom Voice
            </button>
          )}
          <button onClick={onRescore}
            style={{ padding: "8px 16px", background: "#7C5CFC", color: "white", border: "none",
              borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "'Poppins',sans-serif" }}>
            Re-score →
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>

        {/* Score hero */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16, marginBottom: 20,
          opacity: show ? 1 : 0, transition: "opacity 0.5s ease" }}>

          {/* Score circle */}
          <div style={{ background: "white", border: "1px solid #EDE8FF", borderRadius: 16,
            padding: 20, textAlign: "center", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#9CA3AF",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Boom Score</div>
            <div style={{ fontSize: 64, fontWeight: 800, color: gc, lineHeight: 1,
              animation: show ? "scoreIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both" : "none" }}>
              {show ? <AnimatedScore target={overall_score} /> : 0}
            </div>
            <div style={{ display: "inline-block", padding: "4px 14px", background: gBg,
              color: gc, borderRadius: 100, fontSize: 14, fontWeight: 700, marginTop: 6 }}>
              {grade}
            </div>
            <div style={{ height: 4, background: "#EDE8FF", borderRadius: 2, width: "100%", marginTop: 12 }}>
              <div style={{ height: "100%", width: show ? `${overall_score}%` : "0%",
                background: gc, borderRadius: 2, transition: "width 1.2s ease 0.3s" }} />
            </div>
          </div>

          {/* Verdict + meta */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: "14px 16px", background: verdictBg(logo_removal_verdict),
              border: `1px solid ${verdictColor(logo_removal_verdict)}33`, borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace",
                color: verdictColor(logo_removal_verdict), marginBottom: 5 }}>
                Logo Removal Test — {logo_removal_verdict}
              </div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>
                {logo_removal_explanation}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ padding: "10px 14px", background: "white", border: "1px solid #EDE8FF",
                borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "'JetBrains Mono',monospace",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Content type</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", textTransform: "capitalize" }}>
                  {(content_type_inferred || "unknown").replace(/_/g, " ")}
                </div>
              </div>
              <div style={{ padding: "10px 14px", background: "white", border: "1px solid #EDE8FF",
                borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "'JetBrains Mono',monospace",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Scoring mode</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: scoring_mode === "voice-aware" ? "#7C5CFC" : "#1A1A2E" }}>
                  {scoring_mode === "voice-aware" ? "✨ Voice-aware" : "Generic"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #EDE8FF", marginBottom: 20, gap: 0 }}>
          {[
            { id: "overview", label: "Dimensions" },
            { id: "fix", label: `Fix Now (${(fix_now || []).length})` },
            { id: "opportunity", label: "Biggest Opportunity" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "12px 18px", border: "none", background: "transparent",
                fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600,
                cursor: "pointer", color: tab === t.id ? "#7C5CFC" : "#9CA3AF",
                borderBottom: `2.5px solid ${tab === t.id ? "#7C5CFC" : "transparent"}`,
                transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Dimensions tab */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {dimList.map(({ key, label, max }) => {
              const dim = dimensions?.[key];
              if (!dim) return null;
              const pct = dim.score / max;
              const color = pct >= 0.8 ? "#10B981" : pct >= 0.6 ? "#7C5CFC" : pct >= 0.4 ? "#F59E0B" : "#EF4444";
              return (
                <div key={key} style={{ background: "white", border: "1px solid #EDE8FF",
                  borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1A1A2E" }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color }}>{dim.score}</span>
                      <span style={{ fontSize: 12, color: "#C4B5FD", fontFamily: "'JetBrains Mono',monospace" }}>/{max}</span>
                    </div>
                  </div>
                  <ScoreBar score={dim.score} max={max} color={color} />
                  {dim.finding && (
                    <p style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, marginTop: 8 }}>
                      {dim.finding}
                    </p>
                  )}
                  {key === "language_distinctiveness" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      {dim.banned_words_found?.length > 0 && (
                        <div style={{ padding: "8px 10px", background: "#FFF1F0", borderRadius: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#CF1322", letterSpacing: "0.08em",
                            textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", marginBottom: 5 }}>
                            Generic words found
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {dim.banned_words_found.slice(0, 4).map((w, i) => (
                              <span key={i} style={{ padding: "2px 8px", background: "white",
                                border: "1px solid #FFCCC7", borderRadius: 100, fontSize: 11,
                                color: "#CF1322", fontFamily: "'JetBrains Mono',monospace" }}>
                                {w.split("—")[0].trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {dim.owned_phrases_detected?.length > 0 && (
                        <div style={{ padding: "8px 10px", background: "#F6FFED", borderRadius: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#389E0D", letterSpacing: "0.08em",
                            textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", marginBottom: 5 }}>
                            Owned language
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {dim.owned_phrases_detected.slice(0, 4).map((w, i) => (
                              <span key={i} style={{ padding: "2px 8px", background: "white",
                                border: "1px solid #B7EB8F", borderRadius: 100, fontSize: 11,
                                color: "#389E0D", fontFamily: "'JetBrains Mono',monospace" }}>
                                {w}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {key === "confidence" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      {dim.hedges_found?.length > 0 && (
                        <div style={{ padding: "8px 10px", background: "#FFF1F0", borderRadius: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#CF1322", letterSpacing: "0.08em",
                            textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", marginBottom: 5 }}>
                            Hedges found
                          </div>
                          {dim.hedges_found.slice(0, 2).map((h, i) => (
                            <div key={i} style={{ fontSize: 11, color: "#EF4444", fontStyle: "italic",
                              marginBottom: 2 }}>"{h}"</div>
                          ))}
                        </div>
                      )}
                      {dim.strong_claims_found?.length > 0 && (
                        <div style={{ padding: "8px 10px", background: "#F6FFED", borderRadius: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#389E0D", letterSpacing: "0.08em",
                            textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", marginBottom: 5 }}>
                            Strong claims
                          </div>
                          {dim.strong_claims_found.slice(0, 2).map((c, i) => (
                            <div key={i} style={{ fontSize: 11, color: "#389E0D", fontStyle: "italic",
                              marginBottom: 2 }}>"{c}"</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Fix Now tab */}
        {tab === "fix" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(fix_now || []).map((fix, i) => (
              <div key={i} className="fix-card"
                style={{ background: "white", border: `1.5px solid ${fix.impact === "high" ? "#EF444444" : "#EDE8FF"}`,
                  borderLeft: `3px solid ${fix.impact === "high" ? "#EF4444" : "#F59E0B"}`,
                  borderRadius: 14, padding: "16px 18px", transition: "all 0.15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, background: fix.impact === "high" ? "#FFF1F0" : "#FEF3C7",
                    color: fix.impact === "high" ? "#CF1322" : "#D97706",
                    padding: "2px 8px", borderRadius: 100, fontWeight: 700,
                    fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>
                    {fix.impact} impact
                  </span>
                  <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'JetBrains Mono',monospace" }}>
                    {fix.location}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, background: "#F0EBFF", color: "#7C5CFC",
                    padding: "2px 8px", borderRadius: 100, fontFamily: "'JetBrains Mono',monospace" }}>
                    +{fix.score_impact} pts
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", marginBottom: 6 }}>
                  {fix.problem}
                </div>
                {fix.current && (
                  <div style={{ padding: "8px 12px", background: "#FFF1F0", borderRadius: 8,
                    marginBottom: 8, fontSize: 12, color: "#6B7280", fontStyle: "italic",
                    borderLeft: "3px solid #FFCCC7" }}>
                    Current: "{fix.current}"
                  </div>
                )}
                {fix.replacement && (
                  <div style={{ padding: "8px 12px", background: "#F6FFED", borderRadius: 8,
                    fontSize: 12, color: "#374151", borderLeft: "3px solid #B7EB8F" }}>
                    <span style={{ fontWeight: 600, color: "#389E0D" }}>Replace with: </span>
                    "{fix.replacement}"
                  </div>
                )}
              </div>
            ))}

            {/* Boom Voice gate */}
            {scoring_mode === "generic" && boom_voice_preview && (
              <div style={{ padding: 20, background: "#1A1A2E", borderRadius: 16,
                position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.06,
                  background: "radial-gradient(circle at 80% 50%, #7C5CFC, transparent)" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
                    color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em",
                    marginBottom: 10 }}>✨ Voice-aware scoring unlocks</div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65,
                    marginBottom: 16 }}>{boom_voice_preview}</p>
                  <button onClick={onBuildVoice}
                    style={{ padding: "11px 24px", background: "#7C5CFC", color: "white", border: "none",
                      borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'Poppins',sans-serif", boxShadow: "0 4px 16px rgba(124,92,252,0.4)" }}>
                    Build my Boom Voice →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Missed Opportunity tab */}
        {tab === "opportunity" && missed_opportunity && (
          <div>
            <div style={{ background: "white", border: "1.5px solid #7C5CFC33", borderRadius: 14,
              padding: "18px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7C5CFC", letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 }}>
                Highest-value slot on this page
              </div>
              <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                {missed_opportunity.location}
              </div>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, marginBottom: 12 }}>
                {missed_opportunity.what_it_should_be_doing}
              </p>
              {missed_opportunity.current && (
                <div style={{ padding: "10px 14px", background: "#FFF1F0", borderRadius: 10,
                  marginBottom: 10, borderLeft: "3px solid #FFCCC7" }}>
                  <div style={{ fontSize: 10, color: "#CF1322", fontWeight: 700, letterSpacing: "0.06em",
                    textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
                    Currently there
                  </div>
                  <p style={{ fontSize: 13, color: "#6B7280", fontStyle: "italic" }}>"{missed_opportunity.current}"</p>
                </div>
              )}
              {missed_opportunity.replacement && (
                <div style={{ padding: "10px 14px", background: "#F6FFED", borderRadius: 10,
                  borderLeft: "3px solid #B7EB8F" }}>
                  <div style={{ fontSize: 10, color: "#389E0D", fontWeight: 700, letterSpacing: "0.06em",
                    textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
                    Replace with
                  </div>
                  <p style={{ fontSize: 13, color: "#374151" }}>"{missed_opportunity.replacement}"</p>
                </div>
              )}
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, background: "#F0EBFF", color: "#7C5CFC",
                  padding: "3px 10px", borderRadius: 100, fontFamily: "'JetBrains Mono',monospace" }}>
                  +{missed_opportunity.score_impact} pts estimated
                </span>
              </div>
            </div>

            {scoring_mode === "generic" && boom_voice_preview && (
              <div style={{ padding: "16px 20px", background: "#F0EBFF", borderRadius: 14,
                border: "1px solid #DDD6FE" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7C5CFC", letterSpacing: "0.08em",
                  textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
                  With Boom Voice, we'd show you:
                </div>
                <p style={{ fontSize: 13, color: "#4C1D95", lineHeight: 1.65, marginBottom: 12 }}>
                  {boom_voice_preview}
                </p>
                <button onClick={onBuildVoice}
                  style={{ padding: "10px 20px", background: "#7C5CFC", color: "white", border: "none",
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "'Poppins',sans-serif" }}>
                  Build my Boom Voice →
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── SCORE HISTORY CARD ────────────────────────────────────────────────────────
export function ScoreHistoryCard({ entry, onView }) {
  const gc = gradeColor(entry.grade);
  const gBg = gradeBg(entry.grade);
  return (
    <div onClick={onView}
      style={{ background: "white", border: "1px solid #EDE8FF", borderRadius: 14,
        padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(124,92,252,0.1)"; e.currentTarget.style.borderColor = "#C4B5FD"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#EDE8FF"; }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
          {entry._meta?.url
            ? entry._meta.url.replace(/^https?:\/\//, "").slice(0, 40)
            : "Pasted content"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: gc }}>{entry.overall_score}</span>
          <span style={{ padding: "2px 8px", background: gBg, color: gc, borderRadius: 100,
            fontSize: 11, fontWeight: 700 }}>{entry.grade}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: verdictColor(entry.logo_removal_verdict),
          background: verdictBg(entry.logo_removal_verdict),
          padding: "1px 8px", borderRadius: 100, fontFamily: "'JetBrains Mono',monospace" }}>
          {entry.logo_removal_verdict}
        </span>
        <span style={{ fontSize: 11, color: "#C4B5FD", fontFamily: "'JetBrains Mono',monospace" }}>
          {entry._meta?.scored_at?.slice(0, 10) || "today"}
        </span>
        {entry.scoring_mode === "voice-aware" && (
          <span style={{ fontSize: 11, color: "#7C5CFC", fontFamily: "'JetBrains Mono',monospace" }}>
            ✨ voice-aware
          </span>
        )}
      </div>
    </div>
  );
}

export { loadScoreHistory, saveScoreHistory };
