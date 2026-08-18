/**
 * The qtdn chart AST.
 *
 * Every node serializes back to exactly the source lines it was parsed from. That
 * property — see `test/roundtrip.test.ts` — is what lets the structured editor, the tab
 * editor and the raw editor all operate on one representation without any of them being
 * able to corrupt a note on save.
 *
 * Nodes are readonly. Edits produce a new tree rather than mutating in place, so the
 * editor gets undo/redo for free by keeping previous roots.
 */

/** A parsed chart: an ordered list of nodes covering the whole document. */
export interface Chart {
  readonly nodes: readonly Node[];
}

export type Node = Directive | Section | TabBlock | LyricLine | BlankLine | Comment;

/** A metadata line such as `{title: Tempo Perdido}` or a bare `{new_page}`. */
export interface Directive {
  readonly kind: 'directive';
  /** Lowercased directive name, e.g. `title`, `x_qtdn_id`. */
  readonly name: string;
  /** Everything after the first colon, trimmed. `null` for a valueless directive. */
  readonly value: string | null;
}

/** A `{start_of_x}` … `{end_of_x}` region. Sections may nest. */
export interface Section {
  readonly kind: 'section';
  /** The `x` in `start_of_x`, lowercased. */
  readonly name: string;
  /** The optional label: `{start_of_verse: Verse 1}` → `Verse 1`. */
  readonly label: string | null;
  readonly children: readonly Node[];
}

/**
 * A `{start_of_tab}` block. Its lines are held verbatim and never reflowed, because
 * column alignment *is* the content in a tab.
 */
export interface TabBlock {
  readonly kind: 'tab';
  readonly label: string | null;
  readonly lines: readonly string[];
}

/** A line of lyrics with chords attached to positions inside it. */
export interface LyricLine {
  readonly kind: 'lyric';
  readonly segments: readonly Segment[];
}

/**
 * A run of text, optionally preceded by a chord.
 *
 * `[G]Todos os dias quando [D]acordo` parses to two segments: `G`/`Todos os dias quando `
 * and `D`/`acordo`. A line starting with plain text yields a leading segment whose
 * `chord` is `null`.
 */
export interface Segment {
  readonly chord: string | null;
  readonly text: string;
}

/** An empty line. Preserved because spacing is meaningful when reading a chart. */
export interface BlankLine {
  readonly kind: 'blank';
}

/** A `#` comment line. Never rendered on the playing screen. */
export interface Comment {
  readonly kind: 'comment';
  /** The comment text, excluding the leading `#`. */
  readonly text: string;
}

export type DiagnosticCode =
  | 'unclosed-section'
  | 'unmatched-section-end'
  | 'unclosed-tab'
  | 'unclosed-chord'
  | 'empty-directive';

/**
 * A non-fatal parse problem.
 *
 * Parsing never throws: the raw editor has to hold syntactically broken text while you
 * are still typing it, and surface problems as hints rather than as a wall.
 */
export interface Diagnostic {
  /** 1-based line number in the source. */
  readonly line: number;
  readonly code: DiagnosticCode;
  readonly message: string;
}

export interface ParseResult {
  readonly chart: Chart;
  readonly diagnostics: readonly Diagnostic[];
}
