import { describe, expect, it } from 'vitest';

import { fold, matches } from '../search';

describe('fold', () => {
  it('lowercases', () => {
    expect(fold('Corcovado')).toBe('corcovado');
  });

  it.each([
    ['canção', 'cancao'],
    ['Água', 'agua'],
    ['Insensatez à noite', 'insensatez a noite'],
    ['coração', 'coracao'],
  ])('strips the accents from %s', (input, expected) => {
    expect(fold(input)).toBe(expected);
  });

  it('leaves unaccented text alone', () => {
    expect(fold('wave')).toBe('wave');
  });
});

describe('matches', () => {
  it('finds a plain substring', () => {
    expect(matches('Garota de Ipanema', 'ipanema')).toBe(true);
  });

  it('finds accented text typed without accents', () => {
    expect(matches('uma canção', 'cancao')).toBe(true);
  });

  it('finds accented text typed with them', () => {
    expect(matches('uma canção', 'canção')).toBe(true);
  });

  it('requires every term, in any order', () => {
    expect(matches('Wave — Tom Jobim', 'jobim wave')).toBe(true);
    expect(matches('Wave — Tom Jobim', 'jobim corcovado')).toBe(false);
  });

  it('ignores surrounding and repeated whitespace in the query', () => {
    expect(matches('Tom Jobim', '  tom   jobim  ')).toBe(true);
  });

  it('matches nothing for an empty query, rather than everything', () => {
    expect(matches('anything', '')).toBe(false);
    expect(matches('anything', '   ')).toBe(false);
  });

  it('does not match when a term is absent', () => {
    expect(matches('Corcovado', 'wave')).toBe(false);
  });
});
