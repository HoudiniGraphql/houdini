#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const PACKAGES_DIR = 'packages';
const BUILD_DIR = 'build';

// Concurrency limit for parallel publishing to avoid overwhelming npm servers
const MAX_CONCURRENT_PUBLISHES = 5;

// Utility function to limit concurrency
async function limitConcurrency(tasks, limit) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });

    results.push(promise);
    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

function log(message) {
  console.log(`${message}`);
}

function error(message) {
  console.error(`ERROR: ${message}`);
}

function warn(message) {
  console.warn(`WARN: ${message}`);
}

async function runCommand(command, options = {}) {
  try {
    log(`Running: ${command}`);
    const { stdout, stderr } = await execAsync(command, {
      encoding: 'utf8',
      ...options
    });
    return { success: true, output: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      output: err.stdout?.trim() || '',
      stderr: err.stderr?.trim() || ''
    };
  }
}

async function checkPackageExists(name, version) {
  try {
    // Use npm view to check if package exists
    await execAsync(`npm view ${name}@${version}`, {
      encoding: 'utf8'
    });
    return true
  } catch (err) {
    // Package doesn't exist if npm view fails
    return false
  }
}

function getPackageInfo(packageJsonPath) {
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private,
      publishConfig: packageJson.publishConfig,
      optionalDependencies: packageJson.optionalDependencies || {}
    };
  } catch (err) {
    error(`Failed to read ${packageJsonPath}: ${err.message}`);
    return null;
  }
}

function getPreReleaseInfo() {
  const preJsonPath = '.changeset/pre.json';
  
  if (!existsSync(preJsonPath)) {
    return null;
  }
  
  try {
    const preJson = JSON.parse(readFileSync(preJsonPath, 'utf8'));
    return {
      mode: preJson.mode,
      tag: preJson.tag,
      initialVersions: preJson.initialVersions
    };
  } catch (err) {
    error(`Failed to read ${preJsonPath}: ${err.message}`);
    return null;
  }
}

function discoverPackages() {
  const packages = [];

  // Discover regular packages
  const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => join(PACKAGES_DIR, dirent.name));

  for (const packageDir of packageDirs) {
    const packageJsonPath = join(packageDir, 'package.json');
    const packageInfo = getPackageInfo(packageJsonPath);

    if (!packageInfo || packageInfo.private) {
      continue;
    }

    // Check if this is a Go package by looking for main.go
    const isGoPackage = existsSync(join(packageDir, 'main.go'));

    if (isGoPackage) {
      // Go-based package with platform builds
      const buildDir = join(packageDir, BUILD_DIR);
      const buildPackages = discoverBuildPackages(buildDir);
      packages.push({
        type: 'go',
        name: packageInfo.name,
        version: packageInfo.version,
        path: packageDir,
        buildDir: buildDir,
        mainPackage: null, // Will be found in buildPackages
        platformPackages: buildPackages.filter(p => !p.isMainPackage),
        allBuildPackages: buildPackages
      });
    } else {
      // Regular Node.js package
      packages.push({
        type: 'node',
        name: packageInfo.name,
        version: packageInfo.version,
        path: packageDir,
        packageInfo
      });
    }
  }

  return packages;
}

function discoverBuildPackages(buildDir) {
  const buildPackages = [];

  if (!existsSync(buildDir)) {
    return buildPackages;
  }

  const buildSubdirs = readdirSync(buildDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => join(buildDir, dirent.name));

  for (const subdir of buildSubdirs) {
    const packageJsonPath = join(subdir, 'package.json');
    const packageInfo = getPackageInfo(packageJsonPath);

    if (packageInfo) {
      // Main package typically doesn't have platform-specific suffixes
      // Platform packages have names like "houdini-core-darwin-arm64"
      const subdirName = basename(subdir);
      const isMainPackage = !subdirName.includes('-darwin-') &&
                           !subdirName.includes('-linux-') &&
                           !subdirName.includes('-windows-') &&
                           !subdirName.includes('-win32-') &&
                           !subdirName.endsWith('-wasm') &&
                           !packageInfo.os &&
                           !packageInfo.cpu;

      buildPackages.push({
        name: packageInfo.name,
        version: packageInfo.version,
        path: subdir,
        packageInfo,
        isMainPackage
      });
    }
  }

  return buildPackages;
}

async function publishPackage(packagePath, packageName, packageVersion, options = {}) {
  const { isSnapshot = false, snapshotTag = '', preReleaseTag = '', retryOnFailure = true } = options;

  // Check if package already exists
  const packageCheck = await checkPackageExists(packageName, packageVersion);
  if (packageCheck) {
    log(`📦 Package ${packageName}@${packageVersion} already exists`);
    return { success: true, skipped: true };
  }

  log(`🚀 Publishing ${packageName}@${packageVersion} from ${packagePath}...`);

  const publishArgs = ['pnpm', 'publish', '--access', 'public'];

  // Determine which tag to use
  if (isSnapshot && snapshotTag) {
    publishArgs.push('--tag', snapshotTag);
  } else if (preReleaseTag) {
    publishArgs.push('--tag', preReleaseTag);
  }

  // Add provenance if supported
  if (process.env.NPM_CONFIG_PROVENANCE === 'true') {
    publishArgs.push('--provenance');
  }

  // Skip git checks in CI environments to avoid "unclean working tree" errors
  if (process.env.CI) {
    publishArgs.push('--no-git-checks');
  }

  const result = await runCommand(publishArgs.join(' '), { cwd: packagePath });

  if (result.success) {
    log(`✅ Successfully published ${packageName}@${packageVersion}`);
    return { success: true };
  }

  // Enhanced error logging
  error(`Failed to publish ${packageName}:`);
  error(`Command: ${publishArgs.join(' ')}`);
  error(`Working directory: ${packagePath}`);
  error(`Exit code/Error: ${result.error}`);
  if (result.output) {
    error(`STDOUT: ${result.output}`);
  }
  if (result.stderr) {
    error(`STDERR: ${result.stderr}`);
  }

  // Handle common errors - check for various "already published" error formats
  const isAlreadyPublished = result.stderr && (
    result.stderr.includes('You cannot publish over the previously published versions') ||
    result.stderr.includes('already exists') ||
    result.stderr.includes('You cannot publish over') ||
    (result.stderr.includes('403 Forbidden') && result.stderr.includes('publish over'))
  );

  if (isAlreadyPublished) {
    return { success: true, skipped: true };
  }

  if (result.stderr && result.stderr.includes('404') && result.stderr.includes('Not found') && retryOnFailure) {
    warn(`Package ${packageName} not found, might be a new package. Retrying...`);
    // For new packages, sometimes we need to retry
    await new Promise(resolve => setTimeout(resolve, 2000));
    return publishPackage(packagePath, packageName, packageVersion, { ...options, retryOnFailure: false });
  }

  // Check for authentication issues
  if (result.stderr && (result.stderr.includes('401') || result.stderr.includes('403') || result.stderr.includes('authentication'))) {
    error('❌ Authentication failed! Check NPM_TOKEN or OIDC configuration.');
  }

  return { success: false, error: result.error };
}

async function publishGoPackage(mod, options = {}) {
  const results = [];

  // Publish platform packages in parallel with concurrency limit (they're independent)
  log(`📦 Publishing ${mod.platformPackages.length} platform packages for ${mod.name} in parallel...`);
  const platformTasks = mod.platformPackages.map((platformPkg) =>
    () => publishPackage(platformPkg.path, platformPkg.name, platformPkg.version, options)
      .then(result => ({ package: platformPkg.name, ...result }))
  );
  const platformResults = await limitConcurrency(platformTasks, MAX_CONCURRENT_PUBLISHES);
  results.push(...platformResults);

  // Find and publish main package last (it depends on platform packages)
  const mainPackage = mod.allBuildPackages.find(p => p.isMainPackage);
  if (mainPackage) {
    log(`📦 Publishing main package ${mainPackage.name} (depends on platform packages)...`);
    const result = await publishPackage(mainPackage.path, mainPackage.name, mainPackage.version, options);
    results.push({ package: mainPackage.name, ...result });
  }

  return results;
}

async function publishAllPackages(packages, options = {}) {
  const allResults = [];

  // Separate packages by type and dependencies
  const goPackages = packages.filter(pkg => pkg.type === 'go');
  const nodePackages = packages.filter(pkg => pkg.type === 'node');

  // Separate Node.js packages by dependencies
  const corePackages = nodePackages.filter(pkg => pkg.name === 'houdini-core');
  const dependentPackages = nodePackages.filter(pkg => pkg.name === 'houdini'); // depends on houdini-core
  const independentPackages = nodePackages.filter(pkg =>
    pkg.name !== 'houdini-core' && pkg.name !== 'houdini'
  );

  // Phase 1: Publish core dependencies and independent packages in parallel
  log(`🚀 Phase 1: Publishing core packages and independent packages in parallel...`);

  // Create tasks for Node.js packages
  const nodeJsTasks = [
    ...corePackages.map((pkg) =>
      () => publishPackage(pkg.path, pkg.name, pkg.version, options)
        .then(result => ({ package: pkg.name, ...result }))
    ),
    ...independentPackages.map((pkg) =>
      () => publishPackage(pkg.path, pkg.name, pkg.version, options)
        .then(result => ({ package: pkg.name, ...result }))
    )
  ];

  // Run Node.js packages and Go packages in parallel
  const phase1Results = await Promise.all([
    // Node.js packages with concurrency limit
    limitConcurrency(nodeJsTasks, MAX_CONCURRENT_PUBLISHES),
    // Go packages (each handles its own concurrency internally)
    ...goPackages.map(pkg => publishGoPackage(pkg, options))
  ]);
  // Flatten Go package results
  for (const result of phase1Results) {
    if (Array.isArray(result)) {
      allResults.push(...result);
    } else {
      allResults.push(result);
    }
  }

  // Phase 2: Publish packages that depend on core packages
  if (dependentPackages.length > 0) {
    log(`🚀 Phase 2: Publishing packages that depend on core packages...`);
    const phase2Results = await Promise.all(
      dependentPackages.map(async (pkg) => {
        const result = await publishPackage(pkg.path, pkg.name, pkg.version, options);
        return { package: pkg.name, ...result };
      })
    );
    allResults.push(...phase2Results);
  }

  return allResults;
}

function showHelp() {
  console.log(`
Houdini Release Script

Usage:
  node packages/_scripts/release.js [options]

Options:
  --snapshot              Publish snapshot release
  --tag=<tag>            Specify tag for snapshot release (e.g., --tag=commit-abc123)
  --dry-run              Show what would be published without actually publishing
  --help                 Show this help message

Examples:
  node packages/_scripts/release.js                           # Regular release
  node packages/_scripts/release.js --snapshot --tag=test     # Snapshot release
  node packages/_scripts/release.js --dry-run                 # Show publishing plan

NPM Scripts:
  pnpm run release                    # Regular release
  pnpm run release:snapshot           # Snapshot release
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const isSnapshot = args.includes('--snapshot');
  const isDryRun = args.includes('--dry-run');
  const snapshotTag = args.find(arg => arg.startsWith('--tag='))?.split('=')[1];

  log('Starting Houdini release process...');

  // Check for prerelease mode
  const preReleaseInfo = getPreReleaseInfo();
  const isPreRelease = preReleaseInfo !== null;

  if (isPreRelease) {
    log(`🚧 Prerelease mode detected - tag: ${preReleaseInfo.tag}`);
  } else {
    log('📦 Standard release mode');
  }

  // Discover all packages
  const packages = discoverPackages()

  log("🔍 Discovered packages to publish:");
  packages.forEach(pkg => {
    if (pkg.type === 'go') {
      log(`- ${pkg.name} (Go package with ${pkg.platformPackages.length} platform builds)`);
      for (const buildPkg of pkg.platformPackages) {
        log(` └─ ${buildPkg.name}@${buildPkg.version}`);
      }
    } else {
      log(`- ${pkg.name} (Node.js package)`);
    }
  });

  if (isDryRun) {
    log("\n🔍 DRY RUN - Publishing plan:");

    // Show the parallelization plan
    const goPackages = packages.filter(pkg => pkg.type === 'go');
    const nodePackages = packages.filter(pkg => pkg.type === 'node');
    const corePackages = nodePackages.filter(pkg => pkg.name === 'houdini-core');
    const dependentPackages = nodePackages.filter(pkg => pkg.name === 'houdini');
    const independentPackages = nodePackages.filter(pkg =>
      pkg.name !== 'houdini-core' && pkg.name !== 'houdini'
    );

    log("\n📋 Phase 1 (Parallel):");
    if (corePackages.length > 0) {
      log("  🔧 Core packages:");
      corePackages.forEach(pkg => log(`    - ${pkg.name}@${pkg.version}`));
    }
    if (independentPackages.length > 0) {
      log("  📦 Independent Node.js packages:");
      independentPackages.forEach(pkg => log(`    - ${pkg.name}@${pkg.version}`));
    }
    if (goPackages.length > 0) {
      log("  🚀 Go packages (platform packages in parallel, main packages after):");
      goPackages.forEach(pkg => {
        log(`    - ${pkg.name} (${pkg.platformPackages.length} platform packages)`);
        pkg.platformPackages.forEach(p => log(`      └─ ${p.name}@${p.version}`));
        const mainPkg = pkg.allBuildPackages.find(p => p.isMainPackage);
        if (mainPkg) log(`      └─ ${mainPkg.name}@${mainPkg.version} (main)`);
      });
    }

    if (dependentPackages.length > 0) {
      log("\n📋 Phase 2 (After Phase 1):");
      log("  🔗 Packages with dependencies:");
      dependentPackages.forEach(pkg => log(`    - ${pkg.name}@${pkg.version}`));
    }

    log("\n✅ Dry run complete. Use without --dry-run to actually publish.");
    return;
  }

  console.log("\nPublishing packages...")

  try {
    // Publish packages individually
    const results = await publishAllPackages(packages, {
      isSnapshot,
      snapshotTag,
      preReleaseTag: isPreRelease ? preReleaseInfo.tag : ''
    });

    // Summary
    const published = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success);

    log(`\n📊 Publishing Summary:`);
    log(`  ✅ Published: ${published}`);
    log(` ⏭  Skipped: ${skipped}`);
    log(`  ❌ Failed: ${failed.length}\n`);

    if (failed.length > 0) {
      error(`Some packages failed to publish: \n\n${failed.map(result => result.package).join("\n")}`);
      process.exit(1);
    }
  } catch (err) {
    error(`Publishing failed: ${err.message}`);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  error(`Script failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
