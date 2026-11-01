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

If the user wants to review it on GitHub first, create it without `--label ready` and tell them
that adding the label starts the implementation agent.

Report the issue URL and that the implementation agent has started.
