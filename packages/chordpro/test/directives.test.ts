import { describe, expect, it } from 'vitest';

import { isTabEnd, isTabStart } from '../src/index';

/**
 * Shared because three screens were testing for fences with `startsWith('{start_of_tab')`,
 * which disagreed with the parser on both leading whitespace and case — so an indented or
 * uppercase fence was a tab block to one and anonymous metadata to another.
 */
describe('tab fences', () => {
  it.each(['{start_of_tab}', '{start_of_tab: Intro}', '  {START_OF_TAB}  '])(
    'reads %s as opening a block',
    (line) => {
      expect(isTabStart(line)).toBe(true);
      expect(isTabEnd(line)).toBe(false);
    },
  );

  it.each(['{end_of_tab}', '  {END_OF_TAB}'])('reads %s as closing one', (line) => {
    expect(isTabEnd(line)).toBe(true);
    expect(isTabStart(line)).toBe(false);
  });

  it.each(['e|--5--|', '{start_of_verse}', '{title: Wave}', 'start_of_tab', ''])(
    'reads %s as neither',
    (line) => {
      expect(isTabStart(line)).toBe(false);
      expect(isTabEnd(line)).toBe(false);
    },
  );
});
