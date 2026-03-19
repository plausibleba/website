// ─── PlausibleBA — Lead List Endpoint ───────────────────────────────────────
// GET /api/leads?key=<LEADS_API_KEY>
//
// Returns all captured leads from Vercel KV as JSON.
// Protected by a simple API key (env var LEADS_API_KEY).
// For quick checking from a browser or phone.

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // Simple API key protection
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
    // Get all user emails from the sorted set (most recent first)
    const listRes = await fetch(`${kvUrl}/zrange/users:all/0/-1`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });

    if (!listRes.ok) {
      return jsonResponse({ error: "Failed to list users", leads: [] }, 200);
    }

    const listData = await listRes.json();
    const emails: string[] = listData.result || [];

    // Fetch each user record
    const leads = [];
    for (const email of emails) {
      try {
        const userRes = await fetch(`${kvUrl}/get/user:${email}`, {
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
