// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';

// Module Federation remote: the shell loads ./AppDescriptor at runtime.
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const moduleId = (pkg.appManifest?.id ?? 'unknown').replace(/[^a-zA-Z0-9_$]/g, '_');

export default defineConfig(() => ({
	plugins: [
		pluginReact(),
		pluginModuleFederation({
			name: moduleId,
			filename: 'remoteEntry.js',
			exposes: { './AppDescriptor': './src/AppDescriptor.ts' },
			dts: false,
			// runtime: false — the host (the shell) provides the MF runtime;
			// remotes don't embed their own copy, keeping remoteEntry.js
			// stable across app-code-only rebuilds.
			runtime: false,
			// loaded-first: use the host's already-loaded shared instances
			// instead of version-first's boot-time download of EVERY registered
			// remoteEntry.js just to compare shared versions (everything here
			// is singleton + co-deployed).
			shareStrategy: 'loaded-first',
			shared: {
				react: { singleton: true, eager: true, requiredVersion: '^18.2.0' },
				'react-dom': { singleton: true, eager: true, requiredVersion: '^18.2.0' },
				// Platform modules are CONSUMED from the shell's share scope at
				// runtime, never bundled (import: false): the app repo needs no
				// platform checkout to build — editor types come from the
				// installed shell package (the workspace's vendored shell.tgz).
				'shell': { singleton: true, requiredVersion: false, import: false },
				// The SDK surface — runtime values (protocol classes, enums,
				// constants) resolve to the host's singleton so class identity
				// holds across the container boundary.
				'rocketride': { singleton: true, requiredVersion: false, import: false },
				// react-refresh/runtime is deliberately NOT shared: the app's
				// own copy late-attaches to the devtools hook the dev-flavor
				// shell created BEFORE react-dom loaded (injectIntoGlobalHook
				// supports coexisting copies), and MF eager-consume of it
				// inside a remote hard-fails the container.
			},
		}),
	],
	// Treat .pipe files as JSON so pipeline definitions can be imported and
	// passed to client.use({ pipeline }) — the browser has no filesystem, so
	// filepath loading is Node-only.
	// `as const` keeps the rule's `type` a literal for the config typecheck.
	tools: {
		rspack: {
			module: {
				rules: [{ test: /\.pipe$/, type: 'json' } as const],
			},
		},
	},
	// CORS & Host Binding: Ensure strict port 3132 enforcement, dual-stack host binding (0.0.0.0),
	// and explicit cross-origin headers so the RocketRide Shell iframe can reliably load remoteEntry.js.
	server: {
		port: 3132,
		strictPort: true,
		host: '0.0.0.0',
		cors: { origin: '*' },
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
			'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
		},
	},
	// HMR & Dev Client: Bind WebSocket client explicitly to port 3132 to prevent iframe WebSocket drops.
	dev: {
		hmr: true,
		lazyCompilation: false,
		client: { protocol: 'ws', host: 'localhost', port: 3132 } as const,
	},
	source: { entry: { index: './src/index.ts' } },
	output: { assetPrefix: 'auto' },
}));
