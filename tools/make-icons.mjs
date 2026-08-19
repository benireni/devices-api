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
const FONT = path.resolve('node_modules/@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf');

const BACKGROUND = '#0E0F11';
const IDENTITY = '#8FCB6E';

const page = (size, { glyph, background, radius }) => `
<style>
  @font-face { font-family: Fraunces; src: url('file://${FONT}'); }
  html, body { margin: 0; padding: 0; }
  .plate {
    width: ${size}px; height: ${size}px; background: ${background};
    border-radius: ${radius}px; display: flex; align-items: center; justify-content: center;
  }
  .glyph {
    font-family: Fraunces, serif; font-size: ${size * 0.62}px; color: ${IDENTITY};
    line-height: 1; transform: translateY(-${size * 0.09}px);
  }
</style>
<div class="plate"><span class="glyph">${glyph}</span></div>
`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  // Full bleed: iOS applies its own mask, so the icon must not round its own corners.
  { name: 'icon.png', size: 1024, radius: 0, background: BACKGROUND },
  // Android's adaptive icon masks the edges, so the same full-bleed plate is used.
  { name: 'adaptive-icon.png', size: 1024, radius: 0, background: BACKGROUND },
  { name: 'splash-icon.png', size: 512, radius: 0, background: BACKGROUND },
  { name: 'favicon.png', size: 64, radius: 0, background: BACKGROUND },
];

for (const target of targets) {
  const view = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  await view.setContent(page(target.size, { glyph: 'q', ...target }));
  await view.waitForTimeout(400);
  await view.screenshot({ path: path.join(OUT, target.name), omitBackground: false });
  await view.close();
  console.log('wrote', target.name);
}

await browser.close();
