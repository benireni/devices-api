/**
 * Matching for library search.
 *
 * Scanning in memory, not an index. The design document names full-text search as one of
 * the two triggers for introducing SQLite — but a few hundred notes is a scan of a few
 * hundred short strings, which is instant. The trigger is when this is measurably slow,
 * not when the feature exists.
 */

/**
 * Folds case and accents.
 *
 * A Portuguese library is unusable without this: nobody reaches for the accent keys mid
 * search, so `cancao` has to find `canção` and `agua` has to find `Água`.
 */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Every whitespace-separated term must appear somewhere in the haystack.
 *
 * Terms rather than a single substring, so `jobim wave` finds the note however the words
 * are ordered in it. An empty query matches nothing — the caller decides what to show
 * when there is no search, and that is not "everything, unsorted".
 */
export function matches(haystack: string, query: string): boolean {
  const terms = fold(query).split(/\s+/).filter((term) => term !== '');
  if (terms.length === 0) return false;

  const target = fold(haystack);
  return terms.every((term) => target.includes(term));
}
