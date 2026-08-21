import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Drives the app the way a thumb does.
 *
 * Three traps live here rather than in every spec that would otherwise rediscover them:
 *
 * - **A sheet opens over the screen that opened it**, and that screen's own buttons stay
 *   visible behind the scrim. Sheets share label names with them — "Rename", "Delete",
 *   "Save" — so anything inside a sheet is addressed through {@link App.sheet}, which
 *   scopes to the dialog `Modal` renders.
 * - **A dismissed sheet is still on screen while it slides away**, so both copies of a
 *   shared label are visible for a few frames after the tap. Anything that closes a
 *   sheet waits for it to be gone before the next lookup.
 * - **Rows are buttons whose name includes their subtitle.** "Garota de Ipanema" is
 *   named `Garota de Ipanema Tom Jobim / Vinicius de Moraes` to the accessibility tree,
 *   so rows match on substring while buttons match exactly.
 */
export class App {
  constructor(readonly page: Page) {}

  /** Loads a route and waits for the bundle to boot and paint. */
  async open(route = '/'): Promise<void> {
    await this.page.goto(route);
    await this.page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
    );
  }

  /** Goes back the way the header's back button does — without reloading the app. */
  async back(): Promise<void> {
    await this.page.goBack();
  }

  /** A button by its exact label. */
  button(label: string): Locator {
    return this.page.getByRole('button', { name: label, exact: true }).filter({ visible: true });
  }

  /** A list row by its title; its subtitle is part of the accessible name. */
  row(title: string): Locator {
    return this.page.getByRole('button', { name: title }).filter({ visible: true });
  }

  /** Any visible element whose whole text is `label` — chart lines, chords, captions. */
  text(label: string): Locator {
    return this.page.getByText(label, { exact: true }).filter({ visible: true });
  }

  field(placeholder: string): Locator {
    return this.page.getByPlaceholder(placeholder).filter({ visible: true });
  }

  /** The open sheet, as a scope. Every sheet is a `Modal`, which renders as a dialog. */
  sheet(): Locator {
    return this.page.getByRole('dialog');
  }

  /** Waits for the sheet to finish sliding away, so shared labels stop being ambiguous. */
  async settle(): Promise<void> {
    await expect(this.sheet()).toHaveCount(0);
  }

  /**
   * The symbol the chord builder has assembled, which is the sheet's own title.
   *
   * Found through the subtitle because the title collides with the chips below it: while
   * building `A`, the sheet says "A" three times over — once as the symbol and once in
   * each of the two note rows.
   */
  chordSymbol(): Locator {
    return this.sheet()
      .getByText(/^over /)
      .locator('..')
      .locator('div')
      .first();
  }

  async tap(label: string): Promise<void> {
    await this.click(this.button(label).first());
  }

  async tapRow(title: string): Promise<void> {
    await this.click(this.row(title).first());
  }

  async tapText(label: string): Promise<void> {
    await this.click(this.text(label).first());
  }

  /**
   * Taps a control inside the open sheet, not the identically named one behind it.
   *
   * Sheet controls dismiss the sheet, so this waits for it to go. The exceptions say so:
   * a rejected submission keeps its sheet open to show why, and the chord builder's chips
   * go through {@link App.tapChip}.
   */
  async tapInSheet(label: string, { closes = true } = {}): Promise<void> {
    // Not an exact match: a sheet's options are rows, and a row's subtitle is part of its
    // accessible name — "Delete" is named "Delete Removes the whole block if this opens one".
    await this.click(this.sheet().getByRole('button', { name: label }).first());
    if (closes) await this.settle();
  }

  /**
   * Runs one of the note screen's actions.
   *
   * They live behind a header control rather than in the chart, because the chart
   * auto-scrolls and anything inside it travels under the reader's thumb. Deliberately
   * does not wait for the sheet to close: several of these open another one.
   */
  async noteAction(label: string): Promise<void> {
    await this.tap('Actions');
    await this.click(this.sheet().getByRole('button', { name: label }).first());
  }

  /**
   * Taps a chord-builder chip.
   *
   * Root and Bass offer the same twelve notes. The rows render in the order the picker
   * declares them — root, quality, seventh, suspension, tensions, bass — so the first
   * match is the root's and the last is the bass's.
   */
  async tapChip(label: string, row: 'first' | 'bass' = 'first'): Promise<void> {
    const chips = this.sheet().getByRole('button', { name: label, exact: true });
    await this.click(row === 'bass' ? chips.last() : chips.first());
  }

  /**
   * Holds a press long enough for `Pressable` to call `onLongPress`.
   *
   * React Native Web's responder system fires it after 500ms, so the hold has to outlast
   * that with room to spare.
   */
  async longPress(target: Locator): Promise<void> {
    // A sheet still sliding away swallows the hold and the press lands as a tap, which
    // in the editor means the chord picker opens instead of the line menu.
    await this.settle();
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    expect(box, 'the element to long-press is on screen').not.toBeNull();
    if (box === null) return;

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    // Outlasts React Native's 500ms threshold with room to spare. The wait is the
    // gesture here, which is the one place this suite sleeps on purpose.
    await this.page.waitForTimeout(900);
    await this.page.mouse.up();
  }

  /**
   * The visible controls, top to bottom, as text.
   *
   * Order on screen is the only way to assert on sorting: the rows carry no ordinal of
   * their own, and asking each one where it is would say nothing about the list.
   */
  async labels(): Promise<string[]> {
    return this.page.getByRole('button').filter({ visible: true }).allInnerTexts();
  }

  private async click(target: Locator): Promise<void> {
    // No separate scroll step: `click` scrolls into view itself and retries while the
    // element is detached, which a standalone `scrollIntoViewIfNeeded` does not — and
    // every sheet in this app remounts its contents as it opens.
    await target.click();
  }
}
