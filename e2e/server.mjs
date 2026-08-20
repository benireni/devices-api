import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

/**
 * Serves the exported web build.
 *
 * Every unknown path falls back to index.html because the app routes on the client, so a
 * deep link like /logs is the app's job to resolve, not the server's.
 */
const ROOT = path.resolve('apps/mobile/dist-web');
const PORT = Number(process.env.PORT ?? 8099);

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.css': 'text/css',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(ROOT)) {
  console.error(`No web build at ${ROOT}. Run: npm run build:web --workspace @qtdn/mobile`);
  process.exit(1);
}

http
  .createServer((request, response) => {
    const url = decodeURIComponent((request.url ?? '/').split('?')[0]);
    let file = path.join(ROOT, url);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(ROOT, 'index.html');
    }

    response.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    });
    fs.createReadStream(file).pipe(response);
  })
  .listen(PORT, () => {
    console.log(`serving ${ROOT} on ${PORT}`);
  });
