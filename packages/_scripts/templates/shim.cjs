#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const binaryName = process.platform === 'win32' ? 'my-binary.exe' : 'my-binary';

const BINARY_DISTRIBUTION_PACKAGES = {
	'linux-x64':   'my-package-linux-x64',
	'linux-arm64': 'my-package-linux-arm64',
	'win32-x64':   'my-package-win32-x64',
	'win32-arm64': 'my-package-win32-arm64',
	'darwin-x64':  'my-package-darwin-x64',
	'darwin-arm64':'my-package-darwin-arm64',
};

const PLATFORM_OVERRIDE = process.env.HOUDINI_PLATFORM;
const MANUAL_BINARY_PATH = process.env.MY_PACKAGE_BINARY_PATH || process.env.HOUDINI_BINARY_PATH;

// --- WASM path ---
if (PLATFORM_OVERRIDE === 'wasm') {
	const wasmPackage = 'my-package-wasm';
	const wasmBinaryName = 'my-binary.wasm';
	let wasmBin = null;

	try {
		const pkgPath = require.resolve(`${wasmPackage}/package.json`);
		wasmBin = path.join(path.dirname(pkgPath), 'bin', wasmBinaryName);
	} catch {
		const sibling = path.join(__dirname, '..', wasmPackage, 'bin', wasmBinaryName);
		if (fs.existsSync(sibling)) wasmBin = sibling;
	}

	if (!wasmBin || !fs.existsSync(wasmBin)) {
		process.stderr.write(`[my-package] WASM package not installed. Try: npm install ${wasmPackage}\n`);
		process.exit(1);
	}

	// In WebContainers, fs.readSync on a pipe fd is not supported in any thread
	// (the child gets EBADF). Instead:
	//   Main thread  — async process.stdin.on('data') works fine (event loop)
	//   Worker thread — Atomics.wait + receiveMessageOnPort provides real blocking
	// A custom fd_read override feeds WASM stdin from the message channel so WASI
	// never touches fd 0 directly.
	const { Worker, isMainThread, workerData, MessageChannel, receiveMessageOnPort } = require('worker_threads');

	if (isMainThread) {
		const { port1: stdinMain, port2: stdinWorker } = new MessageChannel();
		// Counter: main increments (Atomics.add) per message so rapid bursts
		// (two frames in the same tick) produce two distinct wakeups.
		const syncBuf = new Int32Array(new SharedArrayBuffer(4));

		process.stdin.on('error', () => {});
		process.stdin.on('data', data => {
			stdinMain.postMessage(data);
			Atomics.add(syncBuf, 0, 1);
			Atomics.notify(syncBuf, 0);
		});
		process.stdin.on('end', () => {
			stdinMain.postMessage(null); // EOF sentinel
			Atomics.add(syncBuf, 0, 1);
			Atomics.notify(syncBuf, 0);
		});

		const worker = new Worker(__filename, {
			workerData: { wasmBin, args: process.argv.slice(2), stdinPort: stdinWorker, syncBuf },
			transferList: [stdinWorker],
		});
		worker.on('exit', code => process.exit(code ?? 0));
		return; // prevent fallthrough to native binary path
	} else {
		const { wasmBin: wb, args, stdinPort, syncBuf } = workerData;
		const { WASI } = require('node:wasi');

		const wasi = new WASI({
			args: [wb, ...args],
			env: process.env,
			preopens: { '/': '/' },
			version: 'preview1',
		});

		let wasmMem = null;
		const importObj = wasi.getImportObject();
		const realFdRead = importObj.wasi_snapshot_preview1.fd_read;

		// Override fd_read for stdin (fd 0) only: block via Atomics until the main
		// thread delivers a chunk, then copy it into WASM memory via iov buffers.
		importObj.wasi_snapshot_preview1.fd_read = (fd, iovs, iovsLen, nread) => {
			if (fd !== 0 || !wasmMem) return realFdRead(fd, iovs, iovsLen, nread);

			while (Atomics.load(syncBuf, 0) === 0) {
				Atomics.wait(syncBuf, 0, 0);
			}
			const msg = receiveMessageOnPort(stdinPort);
			Atomics.sub(syncBuf, 0, 1);

			const view = new DataView(wasmMem.buffer);
			if (!msg || msg.message === null) {
				view.setUint32(nread, 0, true); // EOF
				return 0;
			}

			const chunk = msg.message;
			const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			let written = 0;
			for (let i = 0; i < iovsLen; i++) {
				const ptr = view.getUint32(iovs + i * 8, true);
				const len = view.getUint32(iovs + i * 8 + 4, true);
				const n = Math.min(len, buf.length - written);
				if (n <= 0) break;
				new Uint8Array(wasmMem.buffer, ptr, n).set(buf.subarray(written, written + n));
				written += n;
			}
			view.setUint32(nread, written, true);
			return 0;
		};

		const mod = new WebAssembly.Module(fs.readFileSync(wb));
		const inst = new WebAssembly.Instance(mod, importObj);
		wasmMem = inst.exports.memory;
		wasi.start(inst);
		process.exit(0);
	}
}

// --- Native binary path ---
const attempted = [];

function getBinaryPath() {
	if (MANUAL_BINARY_PATH && fs.existsSync(MANUAL_BINARY_PATH)) {
		return MANUAL_BINARY_PATH;
	}

	const platformKey = PLATFORM_OVERRIDE || `${process.platform}-${process.arch}`;
	const platformSpecificPackageName = BINARY_DISTRIBUTION_PACKAGES[platformKey];

	if (!platformSpecificPackageName) {
		if (PLATFORM_OVERRIDE) {
			process.stderr.write(`[my-package] Unknown platform "${PLATFORM_OVERRIDE}". Valid values: ${Object.keys(BINARY_DISTRIBUTION_PACKAGES).join(', ')}, wasm\n`);
			process.exit(1);
		}
		return path.join(__dirname, '..', binaryName);
	}

	// module resolution from the shim's own location: real installs, and any
	// environment that provides NODE_PATH (pnpm scripts do)
	try {
		const platformPackagePath = require.resolve(`${platformSpecificPackageName}/package.json`);
		return path.join(path.dirname(platformPackagePath), 'bin', binaryName);
	} catch {
		attempted.push(`require.resolve('${platformSpecificPackageName}') from ${__dirname}`);
	}

	// module resolution from the invoking project: a linked development setup puts
	// the platform package in the project's node_modules, which the walk from the
	// shim's realpath (inside the linked repo) never visits
	try {
		const platformPackagePath = require.resolve(`${platformSpecificPackageName}/package.json`, {
			paths: [process.cwd()],
		});
		return path.join(path.dirname(platformPackagePath), 'bin', binaryName);
	} catch {
		attempted.push(`require.resolve('${platformSpecificPackageName}') from ${process.cwd()}`);
	}

	// flat node_modules: the platform package next to this one
	const siblingPath = path.join(__dirname, '..', platformSpecificPackageName, 'bin', binaryName);
	if (fs.existsSync(siblingPath)) return siblingPath;
	attempted.push(siblingPath);

	// monorepo build layout: the shim lives at <pkg>/build/my-package/bin and the
	// platform package at <pkg>/build/<platform package>
	const buildSiblingPath = path.join(__dirname, '..', '..', platformSpecificPackageName, 'bin', binaryName);
	if (fs.existsSync(buildSiblingPath)) return buildSiblingPath;
	attempted.push(buildSiblingPath);

	const pnpmMatch = __dirname.match(/(.+\/node_modules\/)\.pnpm\/[^/]+\/node_modules\//);
	if (pnpmMatch) {
		const pnpmDir = path.join(pnpmMatch[1], '.pnpm');
		try {
			const packageJSON = require(path.join(__dirname, '..', 'package.json'));
			const entry = `${platformSpecificPackageName}@${packageJSON.version}`;
			const found = fs.readdirSync(pnpmDir).find(e => e === entry);
			if (found) {
				const p = path.join(pnpmDir, found, 'node_modules', platformSpecificPackageName, 'bin', binaryName);
				if (fs.existsSync(p)) return p;
			}
			attempted.push(path.join(pnpmDir, entry, 'node_modules', platformSpecificPackageName, 'bin', binaryName));
		} catch {}
	}

	// the binary postInstall downloads into the package root when no platform
	// package could be installed (the shim lives in bin/, one level down)
	return path.join(__dirname, '..', binaryName);
}

// Refuse to exec ourselves: when every resolution attempt fails, the final
// candidate (the postInstall download location) can be this very script — exec'ing
// it recurses forever, forking a new node per iteration until the machine chokes.
// A missing binary must be a loud error, never a spawn loop.
const binaryPath = getBinaryPath();
let realBinaryPath = null;
try {
	realBinaryPath = fs.realpathSync(binaryPath);
} catch {}
if (!realBinaryPath || realBinaryPath === fs.realpathSync(__filename)) {
	attempted.push(binaryPath);
	process.stderr.write(
		`[my-package] Could not locate the my-package binary for ${process.platform}-${process.arch}. Tried:\n` +
			attempted.map((p) => `  - ${p}\n`).join('') +
			`Install the platform package for your system or point MY_PACKAGE_BINARY_PATH at the binary.\n`
	);
	process.exit(1);
}

try {
	execFileSync(binaryPath, process.argv.slice(2), { stdio: 'inherit' });
} catch (error) {
	process.exit(error.status || 1);
}
