# PlausibleBA Lead Capture — Setup Guide

## Step 1: Enable Vercel KV (2 minutes)

1. Go to https://vercel.com/terryroach/website
2. Click **Storage** in the left sidebar
3. Click **Create Database** → choose **KV**
4. Name: `plausibleba-leads`
5. Region: pick closest (e.g., US East / SFO)
6. Plan: **Hobby (free)** — 30K requests/month
7. Click **Create** → then **Connect to Project** → select `website`
8. This auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your env vars

## Step 2: Add LEADS_API_KEY env var

1. Go to https://vercel.com/terryroach/website/settings/environment-variables
2. Click **Add Environment Variable**
3. Name: `LEADS_API_KEY`
4. Value: (pick something random, e.g. `pba-leads-2026-xyz123`)
5. Environment: All Environments
6. Save

## Step 3: Create Google Sheet + Apps Script webhook

### 3a. Create the sheet

1. Go to https://sheets.google.com → Create new spreadsheet
2. Name it: `PlausibleBA Leads`
3. In Row 1, add these headers:
   `Timestamp | First Name | Last Name | Email | Generation # | Source`

### 3b. Add the Apps Script

1. In the sheet, go to **Extensions → Apps Script**
2. Delete any existing code in `Code.gs`
3. Paste this:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.firstName || '',
    data.lastName || '',
    data.email || '',
    data.generation || '',
    data.source || 'canvas'
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Click **Deploy → New deployment**
5. Type: **Web app**
6. Execute as: **Me**
7. Who has access: **Anyone**
8. Click **Deploy**
9. Copy the web app URL (looks like `https://script.google.com/macros/s/AKfyc.../exec`)

### 3c. Add the webhook URL to Vercel

1. Go to https://vercel.com/terryroach/website/settings/environment-variables
2. Add: `GSHEET_WEBHOOK_URL` = (paste the Apps Script URL from above)
3. Save

## Step 4: Redeploy

Push the updated `generate.ts` and new `leads.ts` to the `main` branch.
The redeploy will pick up the new env vars automatically.

## Step 5: Verify

1. Go to `https://www.plausibleba.com/canvas` and do a test generation
2. Check the Google Sheet — a new row should appear
3. Check `https://www.plausibleba.com/api/leads?key=YOUR_LEADS_API_KEY`
   — should show the test lead in JSON

## What you get

- **Vercel KV**: Reliable rate limiting (3 gens per email, survives cold starts)
  + a sorted index of all users for the `/api/leads` endpoint
- **Google Sheet**: Human-friendly lead list, updated in real-time,
  viewable from your phone
- **`/api/leads?key=...`**: JSON endpoint you can hit from anywhere
  to see all leads, sorted by most recent

## Environment variables summary

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API key (already set) |
| `KV_REST_API_URL` | Vercel KV endpoint (auto-added by KV setup) |
| `KV_REST_API_TOKEN` | Vercel KV auth token (auto-added by KV setup) |
| `LEADS_API_KEY` | Protects the /api/leads endpoint |
| `GSHEET_WEBHOOK_URL` | Google Apps Script web app URL |
