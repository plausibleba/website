// ─── PlausibleBA Canvas — LLM Generation Proxy ─────────────────────────────
// Edge Runtime for streaming support (30s wall clock on Vercel)
//
// Rate limiting: 3 free generations per email address.
// User data stored in Vercel KV (or in-memory fallback for dev).
//
// POST /api/generate
// Body: { email, firstName, lastName, model, max_tokens, temperature, messages }
// Returns: SSE stream from Anthropic API

export const config = { runtime: "edge" };

// ── In-memory fallback (dev / no KV configured) ────────────────────────────
const memoryStore = new Map<string, { firstName: string; lastName: string; count: number; firstSeen: string; lastSeen: string }>();

const MAX_FREE_GENERATIONS = 3;

async function getUser(email: string): Promise<{ count: number } | null> {
  // Try Vercel KV if available
  if (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.KV_REST_API_URL) {
    try {
      const kvUrl = (globalThis as any).process.env.KV_REST_API_URL;
      const kvToken = (globalThis as any).process.env.KV_REST_API_TOKEN;
      const res = await fetch(`${kvUrl}/get/user:${email}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : null;
      }
    } catch { /* fall through to memory */ }
  }
  return memoryStore.get(email) ?? null;
}

async function setUser(email: string, data: { firstName: string; lastName: string; count: number; firstSeen: string; lastSeen: string }): Promise<void> {
  // Try Vercel KV if available
  if (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.KV_REST_API_URL) {
    try {
      const kvUrl = (globalThis as any).process.env.KV_REST_API_URL;
      const kvToken = (globalThis as any).process.env.KV_REST_API_TOKEN;
      await fetch(`${kvUrl}/set/user:${email}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(JSON.stringify(data)),
      });
      return;
    } catch { /* fall through to memory */ }
  }
  memoryStore.set(email, data);
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
    await setUser(email.toLowerCase().trim(), {
      firstName: firstName ?? existing?.firstName ?? "",
      lastName: lastName ?? existing?.lastName ?? "",
      count: count + 1,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
    });

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
