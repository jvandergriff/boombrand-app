export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const parsed = JSON.parse(body);

  // Add beta header if web search tool is present
  const hasWebSearch = parsed.tools?.some(t => t.type === "web_search_20250305");

  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (hasWebSearch) {
    headers["anthropic-beta"] = "web-search-2025-03-05";
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body,
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ error: "Anthropic returned non-JSON: " + text.slice(0, 200) });
    }
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy failed: " + err.message });
  }
}
