import { expect, test } from '../support/fixtures';

test.describe('the chord strip', () => {
  test('draws an open chord at the nut, not as a barre', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Insensatez');
    await app.noteAction('Source');
    const source = app.field('{title: …}');
    await source.fill(`${await source.inputValue()}\n[C]uma [G]linha [Am]nova`);
    await app.tap('Save');

    // Every diagram used to be a barre: C came out at the third fret, which is not what
    // anyone plays on an acoustic and is worse than showing nothing.
    await expect(app.page.getByText('3fr')).toHaveCount(0);
  });

  test('accounts for every chord in the song, shape or no shape', async ({ app }) => {
    await app.open();
    await app.tapRow('Estudos');
    await app.tapRow('Acordes de passagem');

    // Tensions, slash basses and diminished chords have no honest diagram — which is
    // most of this chart. Dropping them silently made the strip an arbitrary subset;
    // giving each an empty box put a rail of nothing before the first lyric. They are
    // named on one line instead.
    await expect(app.page.getByText(/^No shape: /)).toBeVisible();
    await expect(app.page.getByText(/^No shape: /)).toContainText('C6(9)');
  });

  test('reaches the bass row of the chord builder', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Garota de Ipanema');
    await app.noteAction('Edit');
    await app.tapText('coisa');

    await app.tapChip('D');
    await app.tapChip('m');
    await app.tapChip('G', 'bass');

    await expect(app.chordSymbol()).toHaveText('Dm/G');
  });
});
