# n8n workflows

Two workflows, exported as JSON so they can be imported into any n8n (2.x):

| File | What it does |
|---|---|
| `academy-lifecycle.workflow.json` | Receives events from the app, verifies them, drops duplicates, and sends the right email (and WhatsApp for failed payments). |
| `academy-error-alert.workflow.json` | Runs whenever the lifecycle workflow fails and sends an alert. |

## How an event flows

```
App outbox ──(signed POST, retried with backoff)──▶ Webhook
  ▶ Verify, dedupe & compose (Code)
      ├─ bad signature / older than 5 min ─▶ 401
      ├─ dedupeKey seen before           ─▶ 200 {duplicate: true}
      └─ new                             ─▶ 200 {accepted: true}
           ├─ Email provider? ─▶ Resend  (or "dry run" when no key is set)
           └─ WhatsApp?       ─▶ wait for 08:00 in the student's timezone if it's night ─▶ Cloud API
On any failure ─▶ "Academy – error alert"
```

- **Signature:** `x-academy-signature = "sha256=" + HMAC_SHA256(secret, "<x-academy-timestamp>.<body>")`. Requests older than 5 minutes are rejected (replay protection). The app signs compact JSON, so `JSON.stringify(body)` in n8n reproduces the exact bytes.
- **Duplicates:** the app delivers at least once (it retries after timeouts). n8n remembers each `dedupeKey` for 30 days in the workflow's static data and answers duplicates without sending anything.
- **Personal data** is never stored in the app's outbox; it's added at send time and only travels over the signed request.
- **WhatsApp** goes out only for `payment.failed`, only if the student opted in, and never between 21:00 and 08:00 local time. Business-initiated WhatsApp messages need an approved template (default name `payment_failed`, two body variables: first name, grace end date).

Messages: `student.enrolled`, `student.inactive_3d`, `payment.failed`, `payment.recovered`, `subscription.cancel_scheduled`, `subscription.ended`, `access.revoked`.

## Environment variables (n8n)

| Variable | Required | Notes |
|---|---|---|
| `ACADEMY_SIGNING_SECRET` | yes | Same value as the app's `N8N_SIGNING_SECRET`. |
| `NODE_FUNCTION_ALLOW_BUILTIN=crypto` | yes | Lets the Code node compute the HMAC. |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | yes | Lets nodes read the variables below. |
| `RESEND_API_KEY` | no | Without it, emails are composed but not sent ("dry run"). |
| `EMAIL_FROM` | no | Default `Demo Academy <onboarding@resend.dev>` (Resend's test sender only delivers to your own address). |
| `ALERT_EMAIL` | no | Where failure alerts go. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_PAYMENT_FAILED` | no | Meta WhatsApp Cloud API. |

In production, send alerts through a second channel (Slack/Telegram) too: if the email provider is what's failing, an email alert can't get out.

## Run locally (Docker)

```bash
docker volume create academy_n8n_data
docker run --rm -v academy_n8n_data:/home/node/.n8n -v "$PWD/n8n":/files:ro \
  docker.n8n.io/n8nio/n8n:2.44.7 import:workflow --separate --input=/files
docker run --rm -v academy_n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n:2.44.7 update:workflow --id=acadErrorAlert01 --active=true
docker run --rm -v academy_n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n:2.44.7 update:workflow --id=acadLifecycle001 --active=true
docker run -d --name academy-n8n -p 5678:5678 --env-file n8n.env -v academy_n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n:2.44.7
```

Then set in the app: `N8N_WEBHOOK_URL=http://localhost:5678/webhook/academy-events` and `N8N_SIGNING_SECRET`.

## Verified (26 Oct 2026, n8n 2.44.7)

- 8 real outbox events delivered on the first attempt.
- Duplicate → `{duplicate: true}`; tampered body → 401; 10-minute-old timestamp → 401.
- n8n stopped → event stays `pending` with `fetch failed`, retry in 5 min → delivered on attempt 2 after n8n came back.
- Email provider failure → lifecycle execution fails → error-alert workflow runs with the failing node and error.
