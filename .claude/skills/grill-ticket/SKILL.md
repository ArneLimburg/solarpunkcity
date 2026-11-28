---
name: grill-ticket
description: Interview the user about a feature or bug until it is fully specified, then create a GitHub issue labeled `ready`, which starts the implementation agent. Use when the user wants to write, grill, refine or create a ticket, issue or story.
---

# Grill a ticket

Goal: an issue the implementation agent can complete without asking anything. The issue is
created with the label `ready`; that label immediately starts `.github/workflows/implement.yaml`.

## 1. Understand

- Restate the idea in one or two sentences.
- Read the relevant code (see `CLAUDE.md` for the architecture) so your questions are concrete
  and you can propose answers instead of asking open questions.

## 2. Grill

Ask **one question at a time**, each with your recommended answer. Keep going until all of these
are settled:

- **Goal** – what the player or developer can do afterwards that they cannot do now
- **Behavior** – exact rules, numbers and edge cases (e.g. board bounds, resource costs,
  what happens when resources are missing)
- **Acceptance criteria** – observable and checkable, each one testable by reading code,
  running `npm run build` or trying the app
- **Out of scope** – what must not change
- **Constraints** – files or areas to touch or avoid, assets, performance

The implementation agent cannot change `.github/` or `.claude/`, and cannot change `CLAUDE.md`
once its pull request is open. If the ticket needs such a change, list it under
`## Technical notes` as "To be done by a human" instead of making it an
acceptance criterion.

Push back on vague answers ("better", "nicer", "some") and on tickets that are too big:
one ticket should be one pull request. Offer to split large ideas into several tickets.

The implementation agent has 45 minutes per run (`timeout-minutes` in `implement.yaml`); a
run that hits the limit loses all its work. Keep every ticket small enough:

- One concern per ticket: game rules, UI, or a 3D model. When a ticket touches more than
  one of them, propose a split before drafting, e.g. rules and resources first, then the UI
  that shows them, then the model.
- A 3D model built from code always gets its own ticket.
- Aim for at most about 15 changed files and 500 changed lines in the pull request. Estimate
  this from the files the ticket touches and their tests; split if the estimate is larger.
- Each part must be mergeable on its own (lint, build and tests pass) and leave the game
  playable: no part may make something unbuildable that a later part makes buildable again.
  Name the order under `## Dependencies`, create later parts with the label `planned`
  instead of `ready` and mark each of them as blocked by the parts it needs (see step 4).
  Once the last blocker is merged, `.github/workflows/promote-dependents.yaml` swaps
  `planned` for `ready`, which starts the implementation agent.

Example: a sawmill that turns wood into planks, with apartments built from planks (#86), is
three tickets in this order:

1. **Rules** – the `planks` resource, the `Sawmill` definition, plank storage, the sawmill
   step of the weekly tick and plank delivery to construction sites, with unit tests. The
   sawmill is not offered in the build menu yet, and no building costs planks yet.
2. **Model** – the sawmill model built from code (pure geometry plus renderer, wired into
   the map), with unit tests and an e2e check that places it through the dev hooks.
3. **UI and costs** – the build menu offers the sawmill, the HUD shows planks and waiting
   sites, the details panel shows plank costs, and the apartment switches from wood to
   planks. Only now can players use the chain, so the game is never stuck in between.

## 3. Draft

Show the full issue to the user before creating it:

```markdown
## Goal

<one paragraph>

## Behavior

- <rule>

## Acceptance criteria

- [ ] <checkable criterion>

## Out of scope

- <item>

## Technical notes

- <files, functions, constraints>
```

Write the issue in English, the project language (see `CLAUDE.md`), even when the conversation
is in another language. The title is a short imperative sentence.

## 4. Create

Only after the user confirms the draft:

```bash
gh issue create --title "<title>" --label ready --body-file - <<'EOF'
<body>
EOF
```

For a part that waits for others, use `--label planned` instead and then add a "blocked by"
relationship for every issue it needs (the API takes the blocker's ID, not its number):

```bash
gh api repos/{owner}/{repo}/issues/<dependent>/dependencies/blocked_by \
  -F issue_id="$(gh api repos/{owner}/{repo}/issues/<blocker> --jq .id)"
```

Only these relationships count: a `planned` issue without one is never labeled `ready`
automatically.

If the user wants to review it on GitHub first, create it without `--label ready` and tell them
that adding the label starts the implementation agent.

Report the issue URL and that the implementation agent has started (or, for a `planned` issue,
which issues it waits for).
