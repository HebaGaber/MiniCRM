---
description: Run the full BMAD implementation loop for ONE story (branch -> create-story -> dev-story -> code-review -> test -> PR). Stops on failure. Does NOT merge.
---

You are implementing story **$1** of min-crm. Follow these steps in order and **STOP and report if any step fails** — do not push past a failing gate.

1. Start clean: `git checkout main && git pull`, then create a branch `git checkout -b story/$1-<short-kebab-slug-from-title>`.
2. Run the **bmad-create-story** workflow for $1 to produce the dev-ready story.
3. Run the **bmad-dev-story** workflow to implement $1 strictly against `_bmad-output/project-context.md` (the constitution). If $1 is a UI story, use `prototype/screenshots` + `prototype/tokens` so the result matches the prototype. Keep the app building.
4. Run the **bmad-code-review** workflow. If it reports a blocking issue, fix it and re-review. If it still fails, STOP and report — do not continue.
5. Verify: `npm install` only if dependencies changed, then `npm run test:run`. If tests fail, STOP and report.
6. Commit, push, open a PR (do NOT merge):
   - `git add -A && git commit -m "feat($1): <one-line summary>"`
   - `git push -u origin story/$1-<slug>`
   - `ISSUE=$(gh issue list --repo hebagaber/MiniCRM --search "$1 in:title" --json number -q '.[0].number')`
   - `gh pr create --title "$1 — <story title>" --body "Closes #$ISSUE"`
7. Report: the PR URL, the test result, and a one-line code-review summary. Then STOP. Leave merging to me.
