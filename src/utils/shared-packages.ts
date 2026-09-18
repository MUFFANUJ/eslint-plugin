/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import * as fs from 'fs';
import * as path from 'path';
import { readPackageJson } from './package-json';

/** How far to look upwards for the labextension manifest. */
const MAX_LEVELS = 12;

interface ManifestInfo {
  mtimeMs: number;
  /** Packages the host provides, so this extension does not bundle them. */
  hostProvided: string[];
}

const manifestCache = new Map<string, ManifestInfo | null>();
/** Directory to the manifest which governs it, or null when there is none. */
const manifestPathCache = new Map<string, string | null>();

/**
 * Reads the packages which `jupyterlab.sharedPackages` marks as provided by
 * the application rather than bundled here.
 *
 * `@jupyter/builder` turns `bundled: false` into `import: false`, which leaves
 * the package to the host at runtime. Anything else stays in this extension's
 * own bundle: `bundled: true`, an entry with no `bundled` key, and `false`,
 * which removes the package from the shared scope altogether.
 */
function readManifest(manifestPath: string): ManifestInfo | null {
  const manifest = readPackageJson(manifestPath);
  if (!manifest) {
    return null;
  }

  const cached = manifestCache.get(manifestPath);
  if (cached && cached.mtimeMs === manifest.mtimeMs) {
    return cached;
  }

  const jupyterlab = manifest.data.jupyterlab as
    | { sharedPackages?: Record<string, unknown> }
    | undefined;
  if (!jupyterlab || typeof jupyterlab !== 'object') {
    // Not a labextension manifest, so keep looking further up.
    manifestCache.set(manifestPath, null);
    return null;
  }

  const shared = jupyterlab.sharedPackages ?? {};
  const hostProvided: string[] = [];
  for (const [name, entry] of Object.entries(shared)) {
    if (
      entry &&
      typeof entry === 'object' &&
      (entry as { bundled?: unknown }).bundled === false
    ) {
      hostProvided.push(name);
    }
  }

  const info: ManifestInfo = { mtimeMs: manifest.mtimeMs, hostProvided };
  manifestCache.set(manifestPath, info);
  return info;
}

/**
 * Walks up from a linted file to its labextension manifest and returns the
 * packages the application provides at runtime. Importing one of those at the
 * top of a plugin module adds nothing to the extension's own bundle.
 *
 * Returns an empty list when no manifest declares any, which is the common
 * case outside a monorepo sharing packages between its extensions.
 */
export function getHostProvidedPackages(fromFile: string): string[] {
  const start = path.dirname(path.resolve(fromFile));

  const cachedPath = manifestPathCache.get(start);
  if (cachedPath !== undefined) {
    // Re-enter the reader so an edited manifest is picked up.
    return cachedPath === null
      ? []
      : (readManifest(cachedPath)?.hostProvided ?? []);
  }

  const visited: string[] = [];
  let found: string | null = null;
  let directory = start;
  for (let level = 0; level < MAX_LEVELS; level++) {
    visited.push(directory);
    const manifestPath = path.join(directory, 'package.json');
    if (readManifest(manifestPath)) {
      found = manifestPath;
      break;
    }
    // A repository root bounds the search, so an unrelated manifest further up
    // cannot change what this extension is allowed to import.
    if (fs.existsSync(path.join(directory, '.git'))) {
      break;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }

  for (const seen of visited) {
    manifestPathCache.set(seen, found);
  }
  return found === null ? [] : (readManifest(found)?.hostProvided ?? []);
}
