import { expect, test } from '../support/fixtures';

test.describe('a note', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
  });

  test('shows its chart, the chords it uses and the scroll control', async ({ app }) => {
    await app.tapRow('Garota de Ipanema');

    await expect(app.text('Tom Jobim / Vinicius de Moraes')).toBeVisible();
    await expect(app.text('Olha que coisa mais')).toBeVisible();
    // The chord sits above the word it belongs to, and again in the strip at the top.
    await expect(app.text('F7M')).toHaveCount(2);
    await expect(app.button('Play')).toBeVisible();
  });

  test('renames by rewriting its own title directive', async ({ app }) => {
    await app.tapRow('Garota de Ipanema');
    await app.noteAction('Rename');
    await app.field('Title').fill('Garota renomeada');
    await app.tapInSheet('Rename');

    // In the header and again at the top of the chart.
    await expect(app.text('Garota renomeada')).toHaveCount(2);

    // The library reads titles out of the files, so the folder listing has to agree.
    await app.back();
    await expect(app.row('Garota renomeada')).toBeVisible();
  });

  test('moves to another folder', async ({ app }) => {
    await app.tapRow('Corcovado');
    await app.noteAction('Move');
    await app.tapInSheet('Estudos');

    // Moving returns to the folder the note has just left.
    await expect(app.row('Corcovado')).toHaveCount(0);

    await app.back();
    await app.tapRow('Estudos');
    await expect(app.row('Corcovado')).toBeVisible();
  });

  test('asks before deleting, and says what will be lost', async ({ app }) => {
    await app.tapRow('Insensatez');
    await app.noteAction('Delete');

    await expect(app.text('Delete note?')).toBeVisible();
    await expect(app.sheet()).toContainText('cannot be undone');

    await app.tapInSheet('Cancel');
    await expect(app.button('Actions')).toBeVisible();

    await app.noteAction('Delete');
    await app.tapInSheet('Delete');

    await expect(app.row('Insensatez')).toHaveCount(0);
    await expect(app.row('Corcovado')).toBeVisible();
  });

  test('cannot be moved when there is nowhere to move it', async ({ app }) => {
    // Emptying the library of folders is the only way to reach this state.
    await app.tap('Delete');
    await app.tapInSheet('Delete');
    await app.tapRow('Estudos');
    await app.tap('Delete');
    await app.tapInSheet('Delete');

    await app.tapRow('Ideia de sábado');
    await app.tap('Actions');

    // Not disabled — absent. There is nowhere to move it to, so the row is not offered.
    await expect(app.sheet().getByRole('button', { name: 'Move' })).toHaveCount(0);
  });
});

test.describe('a pending speed change', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
  });

  test('does not bring a deleted note back', async ({ app }) => {
    await app.tapRow('Corcovado');
    // Arms the debounced write, which holds this note's text and its folder.
    await app.tap('Faster');
    await app.noteAction('Delete');
    await app.tapInSheet('Delete');

    await expect(app.row('Corcovado')).toHaveCount(0);

    // Outliving the timer is the point of the test, so the wait is the subject rather
    // than a workaround: the flush used to re-create the file it had just deleted.
    await app.page.waitForTimeout(1200);
    await app.back();
    await app.tapRow('Repertório');

    await expect(app.row('Corcovado')).toHaveCount(0);
  });

  test('does not leave a copy of a moved note behind', async ({ app }) => {
    await app.tapRow('Corcovado');
    await app.tap('Faster');
    await app.noteAction('Move');
    await app.tapInSheet('Estudos');

    await app.page.waitForTimeout(1200);
    await app.back();
    await app.tapRow('Repertório');
    await expect(app.row('Corcovado')).toHaveCount(0);

    await app.back();
    await app.tapRow('Estudos');
    await expect(app.row('Corcovado')).toBeVisible();
  });
});

test.describe('auto-scroll', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    // The longest chart in the demo library: three sections and a tab block. Playback
    // needs something that does not already fit the screen.
    await app.tapRow('Estudos');
    await app.tapRow('Acordes de passagem');
  });

  test('starts and stops', async ({ app }) => {
    await app.tap('Play');
    await expect(app.button('Stop')).toBeVisible();

    await app.tap('Stop');
    await expect(app.button('Play')).toBeVisible();
  });

  test('speed is adjustable and belongs to the song', async ({ app }) => {
    await expect(app.text('25')).toBeVisible();

    await app.tap('Faster');
    await app.tap('Faster');
    await expect(app.text('35')).toBeVisible();

    // Speed is written into the note, so leaving and coming back has to bring it along.
    await app.back();
    await app.tapRow('Acordes de passagem');
    await expect(app.text('35')).toBeVisible();
  });

  test('stops itself when the chart ends', async ({ app }) => {
    // Fastest available, so the end of a short chart arrives in seconds.
    for (let step = 0; step < 19; step += 1) await app.tap('Faster');
    await app.tap('Play');

    // Reverting to Play is what releases the keep-awake lock. Nobody has to reach for
    // the phone at the end of a song.
    await expect(app.button('Play')).toBeVisible({ timeout: 20_000 });
  });

  test('stops when an editor opens over the chart', async ({ app }) => {
    await app.tap('Play');
    await expect(app.button('Stop')).toBeVisible();

    await app.noteAction('Edit');
    await expect(app.button('Add line')).toBeVisible();
    await app.back();

    await expect(app.button('Play')).toBeVisible();
  });

  test('offers nothing to play on a chart that already fits', async ({ app }) => {
    await app.back();
    await app.back();
    await app.tapRow('Ideia de sábado');

    await expect(app.button('Play')).toBeDisabled();
  });

  test('speed stops at its limits', async ({ app }) => {
    // 25 down in steps of 5.
    for (let step = 0; step < 5; step += 1) await app.tap('Slower');

    await expect(app.text('0')).toBeVisible();
    await expect(app.button('Slower')).toBeDisabled();
  });
});
