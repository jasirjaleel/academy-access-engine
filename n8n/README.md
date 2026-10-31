# n8n workflows

Two workflows, exported as JSON so they can be imported into any n8n 2.x, hosted or self-hosted. They use only built-in nodes; emails go to Resend's API through the standard *HTTP Request* node. (A community Resend node was tried first, but on hosts with a temporary disk, such as Heroku, community nodes vanish at the daily restart.)

| File | What it does |
|---|---|
| `academy-lifecycle.workflow.json` | Receives events from the app, verifies them, drops duplicates, and sends the right email. |
| `academy-error-alert.workflow.json` | Runs whenever the lifecycle workflow fails and sends an alert. |

**No server settings are needed.** Everything the workflows use is inside n8n: the shared secret sits in the *Compute expected signature* node, and the Resend key is a normal n8n *Header Auth* credential ("Resend API key"). Importing them never requires changing environment variables or restarting n8n, so other workflows on the same instance aren't affected.

## How an event flows

```
App outbox ──(signed POST, retried with backoff)──▶ Webhook
  ▶ Compute expected signature (Crypto node, HMAC-SHA256 with the shared secret)
  ▶ Verify, dedupe & compose (Code)
      ├─ bad signature / older than 5 min ─▶ 401
      ├─ dedupeKey seen before           ─▶ 200 {duplicate: true}
      └─ new ─▶ Send email? ─▶ Resend  (or "dry run" while SEND_EMAIL is false)
                ├─ sent ─▶ Remember event (save dedupeKey) ─▶ 200 {accepted: true}
                └─ Resend refused (after 3 tries) ─▶ 502 ─▶ Raise error ─▶ app retries later
On any failure ─▶ "Academy – error alert"
```

- **Signature:** `x-academy-signature = "sha256=" + HMAC_SHA256(secret, "<x-academy-timestamp>.<body>")`. Requests older than 5 minutes are rejected (replay protection). The app signs compact JSON, so `JSON.stringify(body)` in n8n reproduces the exact bytes. The comparison is constant-time.
- **Duplicates:** the app delivers at least once (it retries after timeouts and errors). n8n remembers each `dedupeKey` for 30 days in the workflow's static data and answers duplicates without sending anything. The key is saved only *after* the email step succeeds, and the 200 is sent after that. A failed send answers 502 through the node's error output, because a workflow that simply crashes after the webhook can reply 200 with an empty body, which the app would count as delivered.
- **Email body:** every value placed in the HTML is escaped, and a plain-text version is sent alongside it.
- **Personal data** is never stored in the app's outbox; it's added at send time and only travels over the signed request.
- **WhatsApp** was removed for now: Meta charges for business-initiated (template) messages. The app still keeps each student's opt-in, so it can be added back as one more branch.

Messages: `student.enrolled`, `student.inactive_3d`, `payment.failed`, `payment.recovered`, `subscription.cancel_scheduled`, `subscription.ended`, `access.revoked`.

## Set up on an n8n instance

1. **Import the error alert first**, then the lifecycle workflow (n8n → *Create workflow* → ⋯ → *Import from file*).
2. In **Compute expected signature**, paste the same secret as the app's `N8N_SIGNING_SECRET`. The file in this repo holds a placeholder.
3. In the lifecycle workflow, open **Settings → Error workflow** and pick *Academy – error alert* (import gives workflows new IDs, so this link is set by hand).
4. **Activate** both workflows. The webhook URL is `https://<your-n8n>/webhook/academy-events`. Put it in the app's `N8N_WEBHOOK_URL`.
5. **Real emails (optional):** create a *Header Auth* credential named "Resend API key" (Name `Authorization`, Value `Bearer re_…`), select it on **Send email (Resend)** and **Send alert (Resend)**, and set `SEND_EMAIL = true` / `SEND_ALERT = true` at the top of the two Code nodes. Until then, emails are composed and visible in the execution log but not sent ("dry run").
6. **Test inbox (optional):** Resend's test sender (`onboarding@resend.dev`) only delivers to your own Resend address. Set `TEST_INBOX` in *Verify, dedupe & compose* to that address and every student email goes there instead, with the student's address in the subject: `[to: maryam@demo.academy.test] Your payment didn't go through`. Leave it empty once you send from a verified domain.

Tip: if you paste nodes between workflows and signatures start failing, re-enter the secret in *Compute expected signature*. Hidden fields don't always survive a paste.

In production, send alerts through a second channel (Slack/Telegram) too: if the email provider is what's failing, an email alert can't get out.
