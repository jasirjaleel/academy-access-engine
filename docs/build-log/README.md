# Build log

These are the task prompts written at the start of the project, when the plan was to hand each
milestone task to an AI coding agent (Gemini in Antigravity) and review the result.

What actually happened:
- **M1.1** (scaffold) was run with Gemini from `M1.1-scaffold.md`, then reviewed and fixed (font variable, caching setting).
- **Everything after that** was built in Claude Code, working directly from `docs/ARCHITECTURE.md`,
  `docs/DESIGN.md` and `MILESTONES.md`, so the remaining prompts here were not executed as written.

They're kept because they show the plan before the code existed: the scope of each task, which files it
may touch, and the check that had to pass before moving on. Decisions made along the way are in
`docs/DECISIONS.md`.
