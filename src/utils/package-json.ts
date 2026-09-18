/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import * as fs from 'fs';

export interface PackageJsonFile {
  mtimeMs: number;
  data: Record<string, unknown>;
}

interface FailedPackageJsonFile {
  mtimeMs: number;
  data: null;
}

const packageJsonCache = new Map<
  string,
  PackageJsonFile | FailedPackageJsonFile
>();

/**
 * Reads and caches a package.json file until its mtime changes.
 */
export function readPackageJson(packagePath: string): PackageJsonFile | null {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(packagePath).mtimeMs;
  } catch {
    return null;
  }

  const cached = packageJsonCache.get(packagePath);
  if (cached?.mtimeMs === mtimeMs) {
    return cached.data === null ? null : cached;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    packageJsonCache.set(packagePath, { mtimeMs, data: null });
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    packageJsonCache.set(packagePath, { mtimeMs, data: null });
    return null;
  }

  const info: PackageJsonFile = {
    mtimeMs,
    data: parsed as Record<string, unknown>
  };
  packageJsonCache.set(packagePath, info);
  return info;
}
