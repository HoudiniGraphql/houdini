import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// we need to make sure we have executables for houdini
try {
  await fs.symlink(
    path.resolve(__dirname, '../../packages/houdini/build/cmd/index.js'),
    'node_modules/.bin/houdini',
    'file'
  );
} catch {}

// make sure its executable
await fs.chmod('node_modules/.bin/houdini', 0o755);

// create symlinks for houdini plugins to point to their built directories
const plugins = [
  {
    name: 'houdini-svelte',
    path: path.resolve(__dirname, '../../packages/houdini-svelte/build/houdini-svelte')
  },
  {
    name: 'houdini-core',
    path: path.resolve(__dirname, '../../packages/houdini-core/build/houdini-core')
  }
];

for (const plugin of plugins) {
  try {
    // remove existing symlink/directory if it exists
    await fs.rm(`node_modules/${plugin.name}`, { recursive: true, force: true });

    // create symlink to the built plugin directory
    await fs.symlink(plugin.path, `node_modules/${plugin.name}`, 'dir');
  } catch (e) {
    console.warn(`Failed to create symlink for ${plugin.name}:`, e.message);
  }
}
