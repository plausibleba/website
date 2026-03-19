// ─── PlausibleBA Canvas — LLM Generation Proxy ─────────────────────────────
// Edge Runtime for streaming support (30s wall clock on Vercel)
//
// Rate limiting: 3 free generations per email address.
// User data stored in Vercel KV (or in-memory fallback for dev).
// Lead capture: fires webhook to Google Sheets on every generation.
//
// POST /api/generate
// Body: { email, firstName, lastName, model, max_tokens, temperature, messages }
// Returns: SSE stream from Anthropic API

export const config = { runtime: "edge" };

// ── In-memory fallback (dev / no KV configured) ────────────────────────────
const memoryStore = new Map<string, { firstName: string; lastName: string; count: number; firstSeen: string; lastSeen: string }>();

const MAX_FREE_GENERATIONS = 3;

// ── KV helpers ─────────────────────────────────────────────────────────────
function getKVConfig(): { url: string; token: string } | null {
  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) return { url, token };
  } catch { /* env not available */ }
  return null;
}

async function getUser(email: string): Promise<{ firstName?: string; lastName?: string; count: number; firstSeen?: string; lastSeen?: string } | null> {
  const kv = getKVConfig();
  if (kv) {
    try {
      const res = await fetch(`${kv.url}/get/user:${email}`, {
        headers: { Authorization: `Bearer ${kv.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.result) return null;
        let parsed = JSON.parse(data.result);
        if (typeof parsed === "string") parsed = JSON.parse(parsed); // handle legacy double-encoding
        return parsed;
      }
    } catch { /* fall through to memory */ }
  }
  return memoryStore.get(email) ?? null;
}

async function setUser(email: string, data: { firstName: string; lastName: string; count: number; firstSeen: string; lastSeen: string }): Promise<void> {
  const kv = getKVConfig();
  if (kv) {
    try {
      await fetch(`${kv.url}/set/user:${email}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return;
    } catch { /* fall through to memory */ }
  }
  memoryStore.set(email, data);
}

// ── Google Sheets webhook (fire-and-forget) ────────────────────────────────
async function sendToSheet(lead: { firstName: string; lastName: string; email: string; generation: number; source: string }): Promise<void> {
  const webhookUrl = process.env.GSHEET_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("SHEETS: No GSHEET_WEBHOOK_URL configured, skipping");
    return;
  }
  try {
    console.log("SHEETS: Sending lead to webhook...", lead.email);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        ...lead,
      }),
    });
    console.log("SHEETS: Response status:", res.status);
  } catch (err) {
    console.warn("SHEETS: Webhook failed:", err);
  }
}

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "API key not configured" }, 500);
  }

  try {
    const body = await req.json();
    const { email, firstName, lastName, model, max_tokens, temperature, messages } = body;

    // Validate required fields
    if (!email || !messages?.length) {
      return jsonResponse({ error: "Email and messages are required" }, 400);
    }

    // Rate limiting
    const existing = await getUser(email.toLowerCase().trim());
    const count = existing?.count ?? 0;

    if (count >= MAX_FREE_GENERATIONS) {
      return jsonResponse({
        error: "limit_reached",
        message: `You've used all ${MAX_FREE_GENERATIONS} free generations. Open in VCC for unlimited access.`,
        count,
      }, 429);
    }

    // Update user record
    const now = new Date().toISOString();
    const normalEmail = email.toLowerCase().trim();
    const userData = {
      firstName: firstName ?? existing?.firstName ?? "",
      lastName: lastName ?? existing?.lastName ?? "",
      count: count + 1,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
    };
    await setUser(normalEmail, userData);

    // Fire lead to Google Sheets (await so we get logs, but don't block on failure)
    await sendToSheet({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: normalEmail,
      generation: userData.count,
      source: "canvas",
    }).catch(() => {}); // swallow — never block generation

    // Forward to Anthropic
    const anthropicBody = { model, max_tokens, temperature, messages, stream: true };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return new Response(errBody, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Proxy the SSE stream directly
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Generation-Count": String(count + 1),
        "X-Generation-Limit": String(MAX_FREE_GENERATIONS),
      },
    });
  } catch (err) {
    console.error("Generate proxy error:", err);
    return jsonResponse({ error: "Upstream request failed" }, 500);
  }
}

function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
