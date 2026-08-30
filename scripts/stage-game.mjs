import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, 'public', 'game');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const directory of ['css', 'js', 'vendor']) {
  await cp(resolve(root, directory), resolve(destination, directory), {
    recursive: true,
  });
}

await cp(resolve(root, 'index.html'), resolve(destination, 'index.html'));
