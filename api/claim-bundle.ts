// ─── PlausibleBA Canvas → VCC Bundle Claim ──────────────────────────────────
// Edge Runtime — stores a generated bundle in Vercel KV with a short claim
// token so the user can be redirected to VCC and pick it up after auth.
//
// POST /api/claim-bundle
// Body: { bundle, email?, firstName?, lastName? }
// Returns: { token: "bndl_xxxxxxxx" }
//
// GET /api/claim-bundle?token=bndl_xxxxxxxx
// Returns: { bundle, email?, firstName?, lastName? }
//
// Tokens expire after 24 hours. Once claimed (GET), the token is deleted.

export const config = { runtime: "edge" };

const TTL_SECONDS = 86400; // 24 hours

// ── KV helpers ─────────────────────────────────────────────────────────────
function getKVConfig(): { url: string; token: string } | null {
  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) return { url, token };
  } catch { /* env not available */ }
  return null;
}

// In-memory fallback for local dev (no Vercel KV)
const memoryStore = new Map<string, { data: string; expires: number }>();

async function kvSet(key: string, value: string, ttl: number): Promise<void> {
  const kv = getKVConfig();
  if (kv) {
    await fetch(`${kv.url}/set/${key}/${encodeURIComponent(value)}/EX/${ttl}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${kv.token}` },
    });
    return;
  }
  memoryStore.set(key, { data: value, expires: Date.now() + ttl * 1000 });
}

async function kvGet(key: string): Promise<string | null> {
  const kv = getKVConfig();
  if (kv) {
    const res = await fetch(`${kv.url}/get/${key}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result ?? null;
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    memoryStore.delete(key);
    return null;
  }
  return entry.data;
}

async function kvDel(key: string): Promise<void> {
  const kv = getKVConfig();
  if (kv) {
    await fetch(`${kv.url}/del/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${kv.token}` },
    });
    return;
  }
  memoryStore.delete(key);
}

// ── Token generation ───────────────────────────────────────────────────────
function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "bndl_";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  // CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── POST: store bundle, return claim token ──
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { bundle, email, firstName, lastName } = body;

      if (!bundle || typeof bundle !== "object") {
        return jsonResponse({ error: "bundle is required" }, 400, corsHeaders);
      }

      const token = generateToken();
      const payload = JSON.stringify({
        bundle,
        email: email ?? null,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        createdAt: new Date().toISOString(),
      });

      await kvSet(`claim:${token}`, payload, TTL_SECONDS);

      return jsonResponse({ token }, 200, corsHeaders);
    } catch (err) {
      console.error("claim-bundle POST error:", err);
      return jsonResponse({ error: "Failed to store bundle" }, 500, corsHeaders);
    }
  }

  // ── GET: retrieve bundle by claim token ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return jsonResponse({ error: "token parameter is required" }, 400, corsHeaders);
    }

    try {
      const raw = await kvGet(`claim:${token}`);
      if (!raw) {
        return jsonResponse({ error: "token_expired", message: "This bundle link has expired or was already claimed." }, 404, corsHeaders);
      }

      const payload = JSON.parse(raw);

      // Delete after claiming (one-time use)
      await kvDel(`claim:${token}`);

      return jsonResponse(payload, 200, corsHeaders);
    } catch (err) {
      console.error("claim-bundle GET error:", err);
      return jsonResponse({ error: "Failed to retrieve bundle" }, 500, corsHeaders);
    }
  }

  return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
}

function jsonResponse(data: any, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
