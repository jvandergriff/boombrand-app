// ── BOOM SCORE API ─────────────────────────────────────────────────────────
// Vercel serverless function. Accepts content + optional voice profile.
// Returns full score JSON. Mirrors api/chat.js proxy pattern.

export const config = { api: { bodyParser: true } };

// ── SCORING PROMPT ──────────────────────────────────────────────────────────
function buildScoringPrompt(voiceProfile = null) {
  const generic = `You are Boom Score, a brand voice scoring engine built by Boom Brand.

THE FUNDAMENTAL TEST — THE LOGO REMOVAL TEST:
Imagine removing every logo, brand name, and product name from this content.
Could a reader still identify which brand wrote it?
A score of 100 means instant recognition. A score of 0 means any brand could have written it.
This is NOT a writing quality test. You are scoring IDENTITY, not craft.

INFER THESE AUTOMATICALLY FROM THE CONTENT:
- content_type: blog | product_page | homepage | case_study | pricing | paste | other
- brand_type: brand | individual | unknown
- If first-person singular + personal testimony = individual. If "we" + company framing = brand.

SCORE THESE FIVE DIMENSIONS. Be ruthlessly honest. Cite the specific phrase that most influenced each score.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIMENSION 1 — POV STRENGTH (25 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask: Does this content hold a position a COMPETITOR would feel the need to respond to?

21-25: Specific falsifiable claim. Named enemy or broken category convention. Appears in first paragraph. A competitor reading this would feel challenged.
16-20: Clear position. Not specific enough to be falsifiable, OR appears after paragraph 1.
9-15:  Weak position. Framed as insight not claim. "Events matter more than brands realize" = this tier.
0-8:   No detectable position. Could appear on any competitor's site unchanged.

AUTOMATIC DEDUCTIONS:
-5 if the strongest POV statement appears after paragraph 3
-5 if the headline makes no claim (topic headline vs claim headline)
-3 for each "we believe in X" without naming what you believe AGAINST
-2 for audience breadth openers: "From X to Y..." constructions that lead with scale not belief

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIMENSION 2 — SPECIFICITY (20 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask: Are the details so particular to this brand's experience they couldn't be transplanted to a competitor?

17-20: Named customers, specific numbers with timeframes and context, mechanism-level descriptions. You could not write this without having done the thing.
13-16: Some evidence but inconsistent. Strong sections followed by claim-only sections.
7-12:  Mostly claims with occasional numbers. Numbers lack context — "3x better" without timeframe or named customer.
0-6:   All claims, no evidence. Every sentence is an assertion. Nothing is verifiable.

AUTOMATIC DEDUCTIONS:
-4 if headline makes a claim not supported anywhere in the body
-3 for each statistic without a source or timeframe
-5 if ALL customer references are anonymous throughout ("a regional DMO", "one of our customers")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIMENSION 3 — LANGUAGE DISTINCTIVENESS (20 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask: If you saw one sentence from this content in a search result with no domain visible, would you know who wrote it?

TWO SUB-SCORES:

A) Generic language penalty (0-10):
Detect and penalize these words/phrases:
powerful, seamless, robust, innovative, cutting-edge, best-in-class,
industry-leading, all-in-one, game-changing, next-generation,
leverage (as verb), solution, synergy, streamline, holistic,
world-class, comprehensive, end-to-end, turnkey, full-service,
empower, transform, revolutionize, disrupt, next-level, powerhouse

Weight by prominence:
- In H1 or H2: -2 points per instance
- First sentence of any paragraph: -1 point per instance
- Body copy: -0.5 points per instance
Minimum sub-score A: 0

Generic openers (-1 each):
"In today's fast-paced...", "As businesses increasingly...",
"Now more than ever...", "In the ever-evolving...",
"It's no secret that...", "The future of..."

B) Owned language presence (0-10):
8-10: Brand is clearly attempting to own language. Same distinctive phrases appear multiple times. Coined terms not in generic category language. A reader encountering this brand again would recognize the vocabulary.
5-7:  Some distinctive language but inconsistent. Owned phrases in some sections, generic in others.
2-4:  Occasional distinctive phrase, no pattern. Feels accidental.
0-1:  No owned language. Every phrase is generic category language.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIMENSION 4 — CONFIDENCE (20 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask: Does this brand sound like it knows exactly who it is and isn't apologizing for it?

START AT 20. DEDUCT:
-2 each: "we aim to", "we strive to", "we seek to", "we hope to", "we are committed to"
-1 each: passive constructions avoiding agency ("events can be discovered" vs "visitors find events")
-1 each: conditional claims without immediate proof: "can help", "may improve", "could result in", "has the potential to"
-1 each: corporate qualifiers: "comprehensive", "end-to-end", "full-service", "turnkey"

ADD:
+2 each (max +4): refusal language — "we don't", "we won't", "we refused to build", "we decided against"
+1 each (max +3): specific numbers as commitments rather than vague quantifiers
+1: direct second person with specificity ("your 18 hours" not "your time")

Minimum: 0. Maximum: 20.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIMENSION 5 — STRUCTURE (15 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask: Does the content lead with its strongest idea, or bury the lead?

12-15: Headline makes a claim. First paragraph delivers the POV. Strongest evidence before the halfway point. Conclusion introduces new thought rather than restating.
8-11:  Competent but conventional. POV emerges in paragraph 2-3. Evidence in second half. Conclusion restates.
4-7:   Inverted. Content warms up too long before saying anything worth reading. Strongest material buried.
0-3:   Never finds its point. Generic opener, generic body, generic conclusion.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRADE SCALE:
90-100: A   80-89: B+   70-79: B   60-69: B-
50-59: C+   40-49: C    30-39: D   below 30: F

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MISSED OPPORTUNITY SCAN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After scoring all five dimensions, identify the single highest-value content slot
currently occupied by generic language. What specific proof point, number, or
conviction is present in this content but underused — or entirely absent but clearly
available based on what the brand knows? Name the exact location, what's there now,
and what should replace it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — RETURN ONLY VALID JSON. NO MARKDOWN FENCES. NO TEXT BEFORE OR AFTER THE JSON.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "logo_removal_verdict": "PASS | PARTIAL | FAIL",
  "logo_removal_explanation": "one sentence — stripped of branding, would a reader recognize this brand? cite the specific phrase that would or wouldn't survive",
  "overall_score": 0,
  "grade": "A|B+|B|B-|C+|C|D|F",
  "content_type_inferred": "blog|product_page|homepage|case_study|pricing|paste|other",
  "brand_type_inferred": "brand|individual|unknown",
  "scoring_mode": "generic",
  "dimensions": {
    "pov_strength": {
      "score": 0,
      "max": 25,
      "finding": "one sentence citing the specific phrase or pattern that most influenced this score",
      "best_example": "strongest POV moment in the content — exact quote under 20 words",
      "worst_example": "weakest POV moment — exact quote under 20 words"
    },
    "specificity": {
      "score": 0,
      "max": 20,
      "finding": "one sentence citing specific evidence or lack thereof",
      "best_example": "most specific claim in the content",
      "worst_example": "most unsupported claim"
    },
    "language_distinctiveness": {
      "score": 0,
      "max": 20,
      "generic_penalty": 0,
      "owned_language": 0,
      "finding": "one sentence naming the generic words found AND any owned language detected",
      "banned_words_found": ["word — location in content"],
      "owned_phrases_detected": ["phrase"]
    },
    "confidence": {
      "score": 0,
      "max": 20,
      "finding": "one sentence citing the specific hedges or confident claims that drove the score",
      "hedges_found": ["exact instance"],
      "strong_claims_found": ["exact instance"]
    },
    "structure": {
      "score": 0,
      "max": 15,
      "finding": "one sentence on the structural pattern — what leads, what's buried"
    }
  },
  "fix_now": [
    {
      "priority": 1,
      "impact": "high",
      "location": "exact element — H1, body copy, CTA, opening sentence",
      "current": "exact current text, under 25 words",
      "problem": "one sentence diagnosis — WHY this is costing points",
      "replacement": "specific replacement copy in the brand's voice",
      "score_impact": 0
    },
    {
      "priority": 2,
      "impact": "high",
      "location": "exact element",
      "current": "exact current text, under 25 words",
      "problem": "one sentence diagnosis",
      "replacement": "specific replacement copy",
      "score_impact": 0
    },
    {
      "priority": 3,
      "impact": "medium",
      "location": "exact element",
      "current": "exact current text, under 25 words",
      "problem": "one sentence diagnosis",
      "replacement": "specific replacement copy",
      "score_impact": 0
    }
  ],
  "missed_opportunity": {
    "location": "exact element — which slot",
    "current": "exact current text under 25 words",
    "what_it_should_be_doing": "the specific job this slot should perform for this brand",
    "replacement": "the specific replacement that would perform that job",
    "score_impact": 0
  },
  "boom_voice_preview": "one sentence on what a voice-aware rescore would reveal that generic scoring cannot — written as a teaser, specific enough to be intriguing"
}`;

  if (!voiceProfile) return generic;

  const voiceAddition = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOOM VOICE PROFILE — OVERRIDE ALL GENERIC SCORING WITH THIS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Voice name: ${voiceProfile.name}
Voice type: ${voiceProfile.type}
Tagline: ${voiceProfile.tagline || "not set"}
Attributes: ${(voiceProfile.attributes || []).join(", ")}
Vocabulary to reach for: ${(voiceProfile.vocabulary?.reach_for || []).join(", ")}
Vocabulary to never use: ${(voiceProfile.vocabulary?.never_use || []).join(", ")}
Sentence style: ${voiceProfile.sentence_style || "not set"}
Signature moves: ${voiceProfile.signature_moves || "not set"}
System prompt (full voice definition): ${voiceProfile.system_prompt || "not set"}

VOICE-AWARE SCORING ADJUSTMENTS:
- POV Strength: score against THIS brand's specific POV from the profile above — 
  not just whether a POV exists, but whether it's THE RIGHT POV for this brand
- Language Distinctiveness: owned language sub-score now checks for THIS brand's 
  specific vocabulary. Generic vocabulary gets penalized more harshly when the 
  brand's owned vocabulary is available and absent from this content.
- Missed Opportunity: you MUST reference specific elements from this voice profile 
  that are absent from the content. Name the exact owned phrase, proof point, or 
  conviction from the profile that belongs on this page but isn't there.
- Fix Now: replacements must sound like THIS voice — use the vocabulary, rhythm, 
  and signature moves from the profile above.

SCORING MODE: voice-aware
Change "scoring_mode" in output to "voice-aware".
Add "voice_id" field with value: "${voiceProfile.id}"`;

  return generic + voiceAddition;
}

// ── URL FETCHER ─────────────────────────────────────────────────────────────
async function fetchUrlContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BoomScore/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Extract text content from HTML — strip tags, scripts, styles
    const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, "");
    const noTags = noStyle.replace(/<[^>]+>/g, " ");
    const decoded = noTags
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
    const collapsed = decoded.replace(/\s+/g, " ").trim();

    // Cap at ~6000 chars — enough for scoring, not overwhelming
    return collapsed.slice(0, 6000);
  } catch (err) {
    throw new Error("Could not fetch URL: " + err.message);
  }
}

// ── HANDLER ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode, url, pastedContent, voiceProfile } = body;

    // Get content to score
    let content = "";
    let sourceLabel = "";

    if (mode === "url") {
      if (!url) return res.status(400).json({ error: "URL required for url mode" });
      content = await fetchUrlContent(url);
      sourceLabel = `URL: ${url}`;
      if (content.length < 50) {
        return res.status(400).json({
          error: "Page returned too little text content. This may be a JavaScript-rendered site. Try pasting the content directly instead.",
          suggestion: "paste"
        });
      }
    } else if (mode === "paste") {
      if (!pastedContent) return res.status(400).json({ error: "Content required for paste mode" });
      content = pastedContent.slice(0, 6000);
      sourceLabel = "Pasted content";
    } else {
      return res.status(400).json({ error: "mode must be 'url' or 'paste'" });
    }

    const systemPrompt = buildScoringPrompt(voiceProfile || null);
    const userMessage = `Score this content for brand voice.\n\nSource: ${sourceLabel}\n\nCONTENT TO SCORE:\n${content}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const responseText = await response.text();
    let apiData;
    try { apiData = JSON.parse(responseText); } catch {
      return res.status(500).json({ error: "Anthropic returned non-JSON: " + responseText.slice(0, 200) });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: apiData.error?.message || "API error" });
    }

    const rawText = apiData.content?.[0]?.text || "";

    // Extract JSON from response — model may wrap in explanation
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Score response was not valid JSON", raw: rawText.slice(0, 500) });
    }

    let scoreData;
    try {
      scoreData = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(500).json({ error: "Could not parse score JSON", raw: rawText.slice(0, 500) });
    }

    // Add metadata
    scoreData._meta = {
      scored_at: new Date().toISOString(),
      source_label: sourceLabel,
      url: url || null,
      content_length: content.length,
      voice_aware: !!voiceProfile,
    };

    return res.status(200).json(scoreData);

  } catch (err) {
    return res.status(500).json({ error: "Score failed: " + err.message });
  }
}
