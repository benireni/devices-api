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
    await app.tap('Rename');
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
    await app.tap('Move');
    await app.tapInSheet('Estudos');

    // Moving returns to the folder the note has just left.
    await expect(app.row('Corcovado')).toHaveCount(0);

    await app.back();
    await app.tapRow('Estudos');
    await expect(app.row('Corcovado')).toBeVisible();
  });

  test('asks before deleting, and says what will be lost', async ({ app }) => {
    await app.tapRow('Insensatez');
    await app.tap('Delete');

    await expect(app.text('Delete note?')).toBeVisible();
    await expect(app.sheet()).toContainText('cannot be undone');

    await app.tapInSheet('Cancel');
    await expect(app.button('Delete')).toBeVisible();

    await app.tap('Delete');
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

    await expect(app.button('Move')).toBeDisabled();
  });
});

test.describe('auto-scroll', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Garota de Ipanema');
  });

  test('starts and stops', async ({ app }) => {
    await app.tap('Play');
    await expect(app.button('Stop')).toBeVisible();

    await app.tap('Stop');
    await expect(app.button('Play')).toBeVisible();
  });

  test('speed is adjustable and belongs to the song', async ({ app }) => {
    await expect(app.text('25')).toBeVisible();

    await app.tap('+');
    await app.tap('+');
    await expect(app.text('35')).toBeVisible();

    // Speed is written into the note, so leaving and coming back has to bring it along.
    await app.back();
    await app.tapRow('Garota de Ipanema');
    await expect(app.text('35')).toBeVisible();
  });

  test('speed stops at its limits', async ({ app }) => {
    // 25 down in steps of 5.
    for (let step = 0; step < 5; step += 1) await app.tap('−');

    await expect(app.text('0')).toBeVisible();
    await expect(app.button('−')).toBeDisabled();
  });
});
