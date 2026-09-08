// Builds index.html: injects the three standalone mockups + the written spec
// into _template.html. Run: node _build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SPEC from './_spec.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

// JSON.stringify does not escape "/", so a literal </script> inside a mockup
// would close the host <script>. None of them contain one today; guard anyway.
const emb = (s) => JSON.stringify(s).replace(/<\/script/gi, '<\\/script');

const SRC = {
  a: read('a-ledger.html'),
  b: read('b-tape.html'),
  c: read('c-instrument.html'),
};

const out = read('_template.html')
  .replace('__SRC__', `{a:${emb(SRC.a)},b:${emb(SRC.b)},c:${emb(SRC.c)}}`)
  .replace('__SPEC__', `{a:${emb(SPEC.a)},b:${emb(SPEC.b)},c:${emb(SPEC.c)}}`);

fs.writeFileSync(path.join(dir, 'index.html'), out);
console.log('index.html written —', (out.length / 1024).toFixed(1), 'KB');
for (const [k, v] of Object.entries(SRC)) console.log('  ', k, (v.length / 1024).toFixed(1), 'KB');
