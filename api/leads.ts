// ─── PlausibleBA — Lead List Endpoint ───────────────────────────────────────
// GET /api/leads?key=<LEADS_API_KEY>
//
// Returns all captured leads from Vercel KV as JSON.
// Protected by a simple API key (env var LEADS_API_KEY).
// Scans for user:* keys directly (no sorted set dependency).

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expectedKey = process.env.LEADS_API_KEY;

  if (!expectedKey || key !== expectedKey) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return jsonResponse({ error: "KV not configured", leads: [] }, 200);
  }

  try {
    // Scan for all user:* keys using KEYS command via Upstash REST API
    const keysRes = await fetch(`${kvUrl}/keys/user:*`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });

    if (!keysRes.ok) {
      const errText = await keysRes.text();
      return jsonResponse({ error: "Failed to list keys", detail: errText, leads: [] }, 200);
    }

    const keysData = await keysRes.json();
    const userKeys: string[] = keysData.result || [];

    // Fetch each user record
    const leads = [];
    for (const userKey of userKeys) {
      const email = userKey.replace(/^user:/, "");
      try {
        const userRes = await fetch(`${kvUrl}/get/${userKey}`, {
          headers: { Authorization: `Bearer ${kvToken}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.result) {
            const record = JSON.parse(userData.result);
            leads.push({ email, ...record });
          }
        }
      } catch {
        // Skip failed lookups
      }
    }

    // Sort by lastSeen descending (most recent first)
    leads.sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || ""));

    return jsonResponse({
      total: leads.length,
      leads,
    }, 200);
  } catch (err) {
    console.error("Leads endpoint error:", err);
    return jsonResponse({ error: "Failed to fetch leads" }, 500);
  }
}

function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
