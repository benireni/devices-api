import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Renders the app icon and splash mark from the design tokens.
 *
 * Run with `npx playwright@latest node tools/make-icons.mjs`, or install playwright
 * temporarily — it is deliberately not a dependency, since regenerating icons happens
 * when the palette changes and not on every CI run.
 *
 * Generated rather than drawn by hand so the icon cannot drift from the palette: the
 * colours and the display face come from the same places the app reads them.
 */
const OUT = path.resolve('apps/mobile/assets');
const PREVIEW = path.resolve('docs/images');
const FONT = path.resolve('node_modules/@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf');

const BACKGROUND = '#0E0F11';
const IDENTITY = '#8FCB6E';

/**
 * Stacked, not inline.
 *
 * A home screen icon is about 60pt across. Four characters in a row leave each one a
 * fifteenth of that and the name stops being readable; two rows of two give each
 * character more than twice the height for the same square.
 */
const LAYOUT = 'stacked';

const markup = (size, layout) => {
  const stacked = layout === 'stacked';
  const fontSize = stacked ? size * 0.3 : size * 0.235;

  if (!stacked) {
    return `
<style>
  @font-face { font-family: Fraunces; src: url('file://${FONT}'); }
  html, body { margin: 0; padding: 0; }
  .plate {
    width: ${size}px; height: ${size}px; background: ${BACKGROUND};
    display: flex; align-items: center; justify-content: center;
  }
  .mark {
    font-family: Fraunces, serif; font-size: ${fontSize}px; color: ${IDENTITY};
    line-height: 1; transform: translateY(${-size * 0.06}px);
  }
</style>
<div class="plate"><div class="mark">qtdn</div></div>
`;
  }

  // A 2x2 grid rather than two lines of text. Set as type, the horizontal gaps come from
  // each glyph's side bearings and the vertical ones from leading, so the four characters
  // never sit evenly. One cell per character, centred, makes the spacing a single number.
  const cell = fontSize * 1.06;

  return `
<style>
  @font-face { font-family: Fraunces; src: url('file://${FONT}'); }
  html, body { margin: 0; padding: 0; }
  .plate {
    width: ${size}px; height: ${size}px; background: ${BACKGROUND};
    display: flex; align-items: center; justify-content: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, ${cell}px);
    grid-template-rows: repeat(2, ${cell}px);
    /* The q descender reaches further below its cell than the t ascender reaches above,
       so the ink sits low of the geometric centre until it is nudged back. */
    transform: translateY(${-size * 0.025}px);
  }
  .cell {
    display: flex; align-items: center; justify-content: center;
    font-family: Fraunces, serif; font-size: ${fontSize}px; color: ${IDENTITY};
    line-height: 1;
  }
</style>
<div class="plate">
  <div class="grid">
    <div class="cell">q</div><div class="cell">t</div>
    <div class="cell">d</div><div class="cell">n</div>
  </div>
</div>
`;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PREVIEW, { recursive: true });

const render = async (size, layout, file) => {
  const view = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await view.setContent(markup(size, layout));
  await view.waitForTimeout(400);
  await view.screenshot({ path: file });
  await view.close();
  console.log('wrote', path.basename(file));
};

// iOS applies its own mask, so the icon must be full bleed and square-cornered.
await render(1024, LAYOUT, path.join(OUT, 'icon.png'));
await render(1024, LAYOUT, path.join(OUT, 'adaptive-icon.png'));
await render(512, LAYOUT, path.join(OUT, 'splash-icon.png'));
await render(64, LAYOUT, path.join(OUT, 'favicon.png'));

// Both layouts at home-screen size, for judging legibility rather than admiring 1024px.
await render(180, 'stacked', path.join(PREVIEW, 'icon-stacked.png'));
await render(180, 'inline', path.join(PREVIEW, 'icon-inline.png'));

await browser.close();
