# How to run these tasks (Antigravity + Gemini Flash)

1. Open a **new agent conversation per task** (keeps context small).
2. Paste this first line, then the whole task file:
   > Read `AGENTS.md` and `docs/ARCHITECTURE.md` first. Then do exactly this task and nothing else:
3. Let it work. When it's done, **you** run the ✅ Check. Read the diff (`git diff`) before committing; anything outside "Files you may touch" means reject and retry.
4. Commit with the message from the task, then go to the next task.
5. If the agent goes in circles twice on the same error, stop. Paste the error and the file into Opus instead of burning time.

Checkpoints A / B / C: use `_opus-review.md` with Claude Opus.

Model tip: use Flash for scaffolding, UI and simple CRUD. For `lib/billing/*`, `lib/events.ts` and the webhook routes (M4.1, M4.2, M5.x, M7.1), use the strongest model you have, and still review them yourself.
