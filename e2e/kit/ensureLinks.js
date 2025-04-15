import fs from 'node:fs/promises';

// we need to make sure we have executables for houdini
try {
  await fs.symlink(
    '../../../../packages/houdini/build/cmd-esm/index.js',
    'node_modules/.bin/houdini',
    'file'
  );
} catch {}

// make sure its exeecutable
await fs.chmod('node_modules/.bin/houdini', 0o755);
