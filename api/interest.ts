// ─── PlausibleBA — Expression of Interest ───────────────────────────────────
// Edge Runtime. Backs /interest, the page people reach from the QR code at the
// end of a talk (first used at the UTS Executable Twin workshop, 3 Nov 2026).
//
// POST /api/interest
// Body: { name, organisation, role, email, describes[], bring[], bringOther,
//         interest, contact, source, website }   (`website` is a honeypot)
// Stores the latest response per person in Vercel KV under `eoi:<email>`, so
// it never mixes with the Canvas leads under `user:*`, and posts a copy to
// GSHEET_EOI_WEBHOOK_URL when that is set. The Canvas webhook
// (GSHEET_WEBHOOK_URL) is NOT used: its Apps Script writes Canvas columns, and
// an EOI row there would land in the wrong columns. See SETUP-LEADS.md.
//
// GET /api/interest?key=<LEADS_API_KEY>
// Returns every response as JSON, most recent first.

export const config = { runtime: "edge" };

export const DEFAULT_SOURCE = "uts-2026-11-03";

export const DESCRIBES = ["use-case", "consulting-partner", "researcher", "developer", "other"] as const;
export const BRING = ["complex-use-case", "data-or-systems", "clients", "research-capacity", "development-time", "something-else"] as const;

export interface InterestRecord {
  name: string;
  organisation: string;
  role: string;
  describes: string[];
  bring: string[];
  bringOther: string;
  interest: string;
  contact: boolean | null;
  source: string;
  sources: string[];
  submissions: number;
  firstSeen: string;
  lastSeen: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const memoryStore = new Map<string, string>(); // local dev only

function kvConfig(): { url: string; token: string } | null {
  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) return { url, token };
  } catch { /* env not available */ }
  return null;
}

async function kvGet(key: string): Promise<string | null> {
  const kv = kvConfig();
  if (!kv) return memoryStore.get(key) ?? null;
  const res = await fetch(`${kv.url}/get/${key}`, { headers: { Authorization: `Bearer ${kv.token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.result ?? null;
}

async function kvSet(key: string, value: string): Promise<boolean> {
  const kv = kvConfig();
  if (!kv) { memoryStore.set(key, value); return true; }
  const res = await fetch(`${kv.url}/set/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
    body: value,
  });
  return res.ok;
}

async function kvKeys(pattern: string): Promise<string[]> {
  const kv = kvConfig();
  if (!kv) return [...memoryStore.keys()].filter((k) => k.startsWith(pattern.replace("*", "")));
  const res = await fetch(`${kv.url}/keys/${pattern}`, { headers: { Authorization: `Bearer ${kv.token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.result || [];
}

function parseRecord(raw: string | null): InterestRecord | null {
  if (!raw) return null;
  try {
    let parsed = JSON.parse(raw);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return parsed;
  } catch { return null; }
}

const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pick = (v: unknown, allowed: readonly string[]): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : [];
const source = (v: unknown): string => {
  const s = text(v, 60).toLowerCase().replace(/[^a-z0-9-]/g, "");
  return s || DEFAULT_SOURCE;
};

/** Validate and normalise a submission. Returns the fields or an error message for the person. */
export function normalise(body: Record<string, unknown>):
  { ok: true; email: string; fields: Omit<InterestRecord, "sources" | "submissions" | "firstSeen" | "lastSeen"> } | { ok: false; error: string } {
  const email = text(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "Please enter a valid email address." };
  return {
    ok: true,
    email,
    fields: {
      name: text(body.name, 200),
      organisation: text(body.organisation, 200),
      role: text(body.role, 200),
      describes: pick(body.describes, DESCRIBES),
      bring: pick(body.bring, BRING),
      bringOther: text(body.bringOther, 500),
      interest: text(body.interest, 3000),
      contact: body.contact === true || body.contact === "yes" ? true : body.contact === false || body.contact === "no" ? false : null,
      source: source(body.source),
    },
  };
}

async function sendToSheet(email: string, r: InterestRecord): Promise<void> {
  let url: string | undefined;
  try { url = process.env.GSHEET_EOI_WEBHOOK_URL; } catch { /* env not available */ }
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "eoi",
        timestamp: r.lastSeen,
        email,
        name: r.name,
        organisation: r.organisation,
        role: r.role,
        describes: r.describes.join("; "),
        bring: r.bring.join("; "),
        bringOther: r.bringOther,
        interest: r.interest,
        contact: r.contact === null ? "" : r.contact ? "yes" : "no",
        source: r.source,
      }),
    });
  } catch (err) {
    console.warn("EOI: sheet webhook failed", err);
  }
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  if (req.method === "GET") {
    const key = new URL(req.url).searchParams.get("key");
    let expected: string | undefined;
    try { expected = process.env.LEADS_API_KEY; } catch { /* env not available */ }
    if (!expected || key !== expected) return json({ error: "Unauthorized" }, 401);
    const keys = await kvKeys("eoi:*");
    const responses = [];
    for (const k of keys) {
      const r = parseRecord(await kvGet(k));
      if (r) responses.push({ email: k.replace(/^eoi:/, ""), ...r });
    }
    responses.sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || ""));
    return json({ total: responses.length, responses }, 200);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Something went wrong sending the form. Please try again." }, 400); }

  // Honeypot: a person never sees this field. Answer as if it worked; store nothing.
  if (text(body.website, 200)) return json({ ok: true }, 200);

  const n = normalise(body);
  if (!n.ok) return json({ error: n.error }, 400);

  const now = new Date().toISOString();
  const key = `eoi:${n.email}`;
  const prior = parseRecord(await kvGet(key));
  const record: InterestRecord = {
    ...n.fields,
    sources: [...new Set([...(prior?.sources ?? []), n.fields.source])],
    submissions: (prior?.submissions ?? 0) + 1,
    firstSeen: prior?.firstSeen ?? now,
    lastSeen: now,
  };

  const saved = await kvSet(key, JSON.stringify(record));
  if (!saved) return json({ error: "We couldn't save your details just now. Please try again in a minute." }, 502);
  await sendToSheet(n.email, record);
  return json({ ok: true }, 200);
}
