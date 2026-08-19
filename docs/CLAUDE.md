# docs

- `DESIGN.md` — the decision record. Sixteen locked decisions with rationale, the note
  format spec, module boundaries, the schema, the roadmap and the risks. **Read it before
  proposing anything architectural**, and update it when a decision actually changes
  rather than letting code and document drift apart.
- `images/` — screenshots rendered from the real app through `react-native-web`, not
  mockups. Regenerate them when the component set changes visibly, so the README shows
  what the components actually produce.
- `VISUAL-LANGUAGE.md` — the design system written for someone outside the codebase: a
  designer, or a design tool. Lifted from `apps/mobile/src/ui/tokens.ts`, which stays the
  source of truth — when they disagree, the tokens win and this document is stale.
- `adr/` — architecture decision records, once decisions start arriving faster than
  `DESIGN.md` can absorb them.

`DESIGN.md` records decisions and their reasoning. Directory-level `CLAUDE.md` files
record the rules that follow from those decisions. When they disagree, `DESIGN.md` is the
intent and the `CLAUDE.md` is stale.
