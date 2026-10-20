---
title: Claude Code slash command aborts on a failing !`cmd`
tags: [claude-code, slash-commands, shell, exit-code]
source: "INSTANTS /prime fix, 2026-10-19"
created: 2026-10-19
---

# Claude Code slash command aborts on a failing !`cmd`

## Problem
A custom command in `.claude/commands/*.md` fails as a whole ("Shell command failed for pattern ...") when one injected !`cmd` exits non-zero, e.g. `git log` in a repo with no commits yet.

## Instant solution
```markdown
- Git: !`git status --short; git log --oneline -5 2>&1 || true`
```

## Why it works / gotchas
- `2>&1` alone does not help: it only moves the error text, the exit code stays non-zero.
- A `;` chain returns the exit code of its **last** command; a pipe returns the exit code of its last stage (`npm run check | tail` passes because `tail` exits 0).
- Add `|| true` only to commands that may legitimately fail (empty repo, missing folder for `ls`), not to real health checks.
