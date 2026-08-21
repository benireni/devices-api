import type {
  Diagnostic,
  DiagnosticCode,
  LyricLine,
  Node,
  ParseResult,
  Segment,
} from './ast';
import { TAB_SECTION, sectionEndName, sectionStartName } from './directives';

/**
 * Parse ChordPro source into a {@link Chart}.
 *
 * Never throws. Problems come back as diagnostics and the parser recovers by treating
 * the offending text literally, so the result always covers the entire input.
 */
export function parse(source: string): ParseResult {
  return new Parser(source).run();
}

/** Mirrors the frame stack the parser uses while nesting sections. */
interface Frame {
  readonly name: string;
  readonly label: string | null;
  readonly startLine: number;
  readonly children: Node[];
}

class Parser {
  /** The input, consumed left to right by {@link next}. */
  private readonly pending: string[];
  /** How much of {@link pending} has been consumed. */
  private cursor = 0;
  private readonly diagnostics: Diagnostic[] = [];
  private readonly root: Node[] = [];
  private readonly stack: Frame[] = [];
  private lineNo = 0;

  constructor(source: string) {
    this.pending = source.split('\n');
  }

  /**
   * The next line, or `undefined` at end of input.
   *
   * Reads through a cursor rather than shifting the array. `noUncheckedIndexedAccess`
   * types the read as `string | undefined`, so "no more input" stays the ordinary value
   * the caller handles — the same shape a queue gave, with no fallback and no extra
   * branch. Shifting was O(n) per line once V8 stopped using its small-array fast path,
   * which made parsing a long note quadratic: 20k lines took 733ms, and the library
   * re-parses every note on every screen focus.
   */
  private next(): string | undefined {
    const raw = this.pending[this.cursor];
    if (raw !== undefined) {
      this.cursor += 1;
      this.lineNo += 1;
    }
    return raw;
  }

  run(): ParseResult {
    for (let raw = this.next(); raw !== undefined; raw = this.next()) {
      this.consume(raw, this.lineNo);
    }

    // An unterminated section is repaired rather than dropped: the serializer will emit
    // the missing end directive, which is the behaviour that loses the least work.
    for (let frame = this.stack.pop(); frame !== undefined; frame = this.stack.pop()) {
      this.report(frame.startLine, 'unclosed-section', `Section "${frame.name}" is never closed.`);
      this.emit({
        kind: 'section',
        name: frame.name,
        label: frame.label,
        children: frame.children,
      });
    }

    return { chart: { nodes: this.root }, diagnostics: this.diagnostics };
  }

  private consume(raw: string, lineNo: number): void {
    if (raw.trim() === '') {
      this.emit({ kind: 'blank' });
      return;
    }

    if (raw.startsWith('#')) {
      this.emit({ kind: 'comment', text: raw.slice(1) });
      return;
    }

    const directive = parseDirective(raw);
    if (!directive) {
      this.emit(this.parseLyric(raw, lineNo));
      return;
    }

    if (directive.name === '') {
      this.report(lineNo, 'empty-directive', 'Directive has no name.');
      this.emit({ kind: 'directive', name: '', value: directive.value });
      return;
    }

    const opens = sectionStartName(directive.name);
    if (opens !== null) {
      if (opens === TAB_SECTION) {
        this.emit(this.readTabBlock(directive.value, lineNo));
      } else {
        this.stack.push({
          name: opens,
          label: directive.value,
          startLine: lineNo,
          children: [],
        });
      }
      return;
    }

    const closes = sectionEndName(directive.name);
    if (closes !== null) {
      this.closeSection(closes, directive, lineNo);
      return;
    }

    this.emit({ kind: 'directive', name: directive.name, value: directive.value });
  }

  private closeSection(closes: string, directive: RawDirective, lineNo: number): void {
    const open = this.stack.at(-1);
    if (!open || open.name !== closes) {
      // Keeping the stray directive as a plain node means the text survives a
      // parse/serialize cycle even though the document is malformed.
      this.report(
        lineNo,
        'unmatched-section-end',
        `"${directive.name}" does not close an open section.`,
      );
      this.emit({ kind: 'directive', name: directive.name, value: directive.value });
      return;
    }

    this.stack.pop();
    this.emit({
      kind: 'section',
      name: open.name,
      label: open.label,
      children: open.children,
    });
  }

  /** Reads lines verbatim until `{end_of_tab}`. Column alignment is the content. */
  private readTabBlock(label: string | null, startLine: number): Node {
    const content: string[] = [];

    for (let raw = this.next(); raw !== undefined; raw = this.next()) {
      const directive = parseDirective(raw);
      if (directive && sectionEndName(directive.name) === TAB_SECTION) {
        return { kind: 'tab', label, lines: content };
      }
      content.push(raw);
    }

    this.report(startLine, 'unclosed-tab', 'Tab block is never closed.');
    return { kind: 'tab', label, lines: content };
  }

  private parseLyric(raw: string, lineNo: number): LyricLine {
    const segments: Segment[] = [];
    let chord: string | null = null;
    let cursor = 0;

    for (;;) {
      const open = raw.indexOf('[', cursor);

      if (open === -1) {
        const text = raw.slice(cursor);
        // At least one segment always results: this runs only for non-blank lines, so
        // if no chord has been seen yet the whole line is still sitting in `text`.
        if (text !== '' || chord !== null) {
          segments.push({ chord, text });
        }
        return { kind: 'lyric', segments };
      }

      const close = raw.indexOf(']', open + 1);
      if (close === -1) {
        // No closing bracket: the rest of the line is literal text, which is both the
        // forgiving reading and the one that survives a round trip unchanged.
        this.report(lineNo, 'unclosed-chord', 'Chord bracket is never closed.');
        segments.push({ chord, text: raw.slice(cursor) });
        return { kind: 'lyric', segments };
      }

      const text = raw.slice(cursor, open);
      if (text !== '' || chord !== null) {
        segments.push({ chord, text });
      }
      chord = raw.slice(open + 1, close);
      cursor = close + 1;
    }
  }

  private emit(node: Node): void {
    (this.stack.at(-1)?.children ?? this.root).push(node);
  }

  private report(line: number, code: DiagnosticCode, message: string): void {
    this.diagnostics.push({ line, code, message });
  }
}

interface RawDirective {
  readonly name: string;
  readonly value: string | null;
}

/** Recognizes a whole-line `{name}` or `{name: value}`. Returns `null` otherwise. */
function parseDirective(raw: string): RawDirective | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}') || trimmed.length < 2) {
    return null;
  }

  const body = trimmed.slice(1, -1);
  const colon = body.indexOf(':');
  if (colon === -1) {
    return { name: body.trim().toLowerCase(), value: null };
  }

  return {
    name: body.slice(0, colon).trim().toLowerCase(),
    value: body.slice(colon + 1).trim(),
  };
}
