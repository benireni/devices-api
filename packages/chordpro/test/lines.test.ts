import { describe, expect, it } from 'vitest';

import { appendSection, isFence, moveLine, removeLine, tabBody } from '../src/index';

const VERSE = [
  '{title: Wave}',
  '',
  '{start_of_verse: A}',
  '[D7M]primeira',
  '[Am7]segunda',
  '{end_of_verse}',
];

describe('isFence', () => {
  it.each(['{start_of_verse}', '{end_of_verse}', '{start_of_tab: Intro}', '{END_OF_TAB}'])(
    'recognises %s',
    (line) => {
      expect(isFence(line)).toBe(true);
    },
  );

  it.each(['{title: Wave}', '[D7M]lyric', '', 'not a directive'])(
    'does not mistake %s for a fence',
    (line) => {
      expect(isFence(line)).toBe(false);
    },
  );
});

describe('moveLine', () => {
  it('swaps a line with its neighbour', () => {
    expect(moveLine(VERSE, 3, 1)[3]).toBe('[Am7]segunda');
    expect(moveLine(VERSE, 3, 1)[4]).toBe('[D7M]primeira');
  });

  it('moves upwards too', () => {
    expect(moveLine(VERSE, 4, -1)[3]).toBe('[Am7]segunda');
  });

  it('refuses to cross a section boundary', () => {
    // Line 3 is the first inside the verse; above it is the opening fence.
    expect(moveLine(VERSE, 3, -1)).toEqual(VERSE);
    expect(moveLine(VERSE, 4, 1)).toEqual(VERSE);
  });

  it('refuses to move a fence itself', () => {
    expect(moveLine(VERSE, 2, 1)).toEqual(VERSE);
  });

  it('does nothing at the ends of the note', () => {
    expect(moveLine(VERSE, 0, -1)).toEqual(VERSE);
    expect(moveLine(VERSE, VERSE.length - 1, 1)).toEqual(VERSE);
  });

  it('does nothing for an index that is not there', () => {
    expect(moveLine(VERSE, 99, 1)).toEqual(VERSE);
  });
});

describe('removeLine', () => {
  it('removes a single lyric line', () => {
    expect(removeLine(VERSE, 3)).toEqual([
      '{title: Wave}',
      '',
      '{start_of_verse: A}',
      '[Am7]segunda',
      '{end_of_verse}',
    ]);
  });

  it('takes the whole section when the opening fence goes', () => {
    expect(removeLine(VERSE, 2)).toEqual(['{title: Wave}', '']);
  });

  it('takes the whole section from the closing fence too', () => {
    expect(removeLine(VERSE, 5)).toEqual(['{title: Wave}', '']);
  });

  it('takes a whole tab block, so its contents are never orphaned', () => {
    const lines = ['{start_of_tab}', 'e|--0--|', '{end_of_tab}', 'after'];
    expect(removeLine(lines, 0)).toEqual(['after']);
  });

  it('handles a section nested inside one of the same name', () => {
    const lines = [
      '{start_of_verse}',
      'outer',
      '{start_of_verse}',
      'inner',
      '{end_of_verse}',
      '{end_of_verse}',
      'after',
    ];
    expect(removeLine(lines, 0)).toEqual(['after']);
    expect(removeLine(lines, 2)).toEqual([
      '{start_of_verse}',
      'outer',
      '{end_of_verse}',
      'after',
    ]);
  });

  it('removes only the fence when its partner is missing', () => {
    const lines = ['{start_of_verse}', 'orphan'];
    expect(removeLine(lines, 0)).toEqual(['orphan']);
  });

  it('removes a metadata line on its own', () => {
    expect(removeLine(VERSE, 0)[0]).toBe('');
    expect(removeLine(VERSE, 0)).toHaveLength(VERSE.length - 1);
  });

  it('removes only the fence when a closing one has no partner', () => {
    expect(removeLine(['orphan', '{end_of_verse}'], 1)).toEqual(['orphan']);
  });

  it('does nothing for an index that is not there', () => {
    expect(removeLine(VERSE, 99)).toEqual(VERSE);
  });
});

describe('appendSection', () => {
  it('adds an empty labelled section', () => {
    expect(appendSection(['a'], 'chorus', 'Refrão')).toEqual([
      'a',
      '',
      '{start_of_chorus: Refrão}',
      '',
      '{end_of_chorus}',
    ]);
  });

  it('omits the label when there is none', () => {
    expect(appendSection([], 'bridge', null)).toEqual([
      '',
      '{start_of_bridge}',
      '',
      '{end_of_bridge}',
    ]);
  });
});

describe('tabBody', () => {
  it('marks a tab block’s content and its closing fence, but not its handle', () => {
    const lines = ['before', '{start_of_tab}', 'e|--5--|', 'B|--5--|', '{end_of_tab}', 'after'];

    expect(tabBody(lines)).toEqual([false, false, true, true, true, false]);
  });

  it('marks nothing in a note with no tab', () => {
    expect(tabBody(['{title: Wave}', '[D7M]a'])).toEqual([false, false]);
  });

  it('handles two tab blocks', () => {
    const lines = [
      '{start_of_tab}',
      'a',
      '{end_of_tab}',
      'between',
      '{start_of_tab}',
      'b',
      '{end_of_tab}',
    ];

    expect(tabBody(lines)).toEqual([false, true, true, false, false, true, true]);
  });

  it('treats an unclosed block as running to the end, so its content is never offered as lyrics', () => {
    expect(tabBody(['{start_of_tab}', 'e|--5--|'])).toEqual([false, true]);
  });
});
