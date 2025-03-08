import fs from 'fs/promises';

// we need to set up the packages for the e2e tests. since they are generated
// we need to copy them from the various build directories and put them in our node_modules
// get the list of directories in the build directory

for (const pkg of ['houdini-core', 'houdini-svelte', 'plugin-svelte-global-stores']) {
  const buildDir = `../../packages/${pkg}/build`;
  const dirs = await fs.readdir(buildDir);

  // make sure the node_modules directory exists
  try {
    await fs.mkdir('node_modules');
  } catch (e) {
    // ignore
  }

  // copy the directories to the node_modules
  await Promise.all(
    dirs.map(async (dir) => {
      try {
        await fs.symlink(`../${buildDir}/${dir}`, `node_modules/${dir}`, 'dir');
      } catch (e) {
        // ignore
      }
    })
  );
}
