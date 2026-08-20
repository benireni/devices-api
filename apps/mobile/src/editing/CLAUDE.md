# Editing

Undo, kept as an immutable value rather than a mutable stack.

Both editors already hold their document as an immutable snapshot — an array of source
lines, a tab grid — so undo is just keeping the previous ones. Nothing in this module
knows what a note is, which is why it serves both.

## Rules

- **Every edit goes through the commit path.** An editor that mutates its document
  directly for "just this one case" produces an undo that skips a step, which is worse
  than no undo — the user presses it and something they did not expect comes back.
- **Equality is the caller's business.** Documents are new arrays or objects on every
  edit, so reference identity is never the right comparison. Pass the comparison that
  suits the document; `commit` drops a no-op edit so undo never appears to do nothing.
- **`reset` is for loading, not editing.** Replacing the document on open must not leave
  a step that would undo back into the previous note.

## Redo is deliberately absent

It was not asked for, and the pair costs more than a second stack: every edit made after
an undo has to decide what happens to the abandoned redo branch. That is a rule worth
designing when someone wants it, not guessing at now.
