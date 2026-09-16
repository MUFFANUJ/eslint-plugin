/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ALWAYS_IGNORED_IMPORTS, matchesPatterns } from './lazy-imports';

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** Suffixes an ESM specifier may carry which the source file does not. */
const OUTPUT_TO_SOURCE: Record<string, string[]> = {
  '.js': ['.ts', '.tsx', '.js', '.jsx'],
  '.mjs': ['.mts', '.mjs'],
  '.cjs': ['.cts', '.cjs']
};

/** Stops a pathological import graph from dominating lint time. */
const MAX_FILES = 300;
const MAX_DEPTH = 12;

interface FileInfo {
  mtimeMs: number;
  /** Bytes of code left once TypeScript has compiled the module away. */
  size: number;
  /** Resolved paths of the statically imported relative modules. */
  dependencies: string[];
}

const fileCache = new Map<string, FileInfo | null>();

/**
 * Resolves a relative import specifier to a file, trying the usual extensions
 * and an `index` file inside a directory. A specifier written for ESM output,
 * such as `./widget.js`, also resolves to the source it was compiled from.
 * Returns null for a bare package specifier, or when nothing matches.
 */
export function resolveRelativeModule(
  specifier: string,
  fromFile: string
): string | null {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const base = path.resolve(path.dirname(fromFile), specifier);

  const outputExtension = path.extname(base);
  const sourceExtensions = OUTPUT_TO_SOURCE[outputExtension];
  if (sourceExtensions) {
    const withoutExtension = base.slice(0, -outputExtension.length);
    for (const extension of sourceExtensions) {
      const candidate = withoutExtension + extension;
      if (isFile(candidate)) {
        return candidate;
      }
    }
  }

  const candidates = [
    ...CODE_EXTENSIONS.map(extension => base + extension),
    ...CODE_EXTENSIONS.map(extension => path.join(base, `index${extension}`))
  ];
  for (const candidate of candidates) {
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return isFile(base) ? base : null;
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Compiles a module and returns the bytes it contributes to a bundle. Comments
 * and everything TypeScript erases are gone from the result, so a file of
 * interface declarations measures near zero.
 */
function compiledSize(filePath: string, source: string): number {
  const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
  let emitted: string;
  try {
    emitted = ts.transpileModule(source, {
      fileName: filePath,
      reportDiagnostics: false,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        removeComments: true,
        isolatedModules: true,
        jsx: isTsx ? ts.JsxEmit.Preserve : undefined
      }
    }).outputText;
  } catch {
    emitted = source;
  }
  return Buffer.byteLength(emitted.replace(/\s+/g, ' ').trim(), 'utf8');
}

/**
 * Collects the relative modules a file imports at run time. Type-only imports
 * are skipped because TypeScript erases them, and so are dynamic imports,
 * which are deferred already.
 */
function collectDependencies(filePath: string, source: string): string[] {
  const dependencies: string[] = [];
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.ES2020,
      false
    );
  } catch {
    return dependencies;
  }

  for (const statement of sourceFile.statements) {
    let specifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(statement)) {
      if (statement.importClause?.isTypeOnly) {
        continue;
      }
      specifier = statement.moduleSpecifier;
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) {
        continue;
      }
      specifier = statement.moduleSpecifier;
    }
    if (!specifier || !ts.isStringLiteral(specifier)) {
      continue;
    }
    if (matchesPatterns(specifier.text, ALWAYS_IGNORED_IMPORTS)) {
      // An asset the bundler turns into a URL adds nothing to the bundle.
      continue;
    }
    const resolved = resolveRelativeModule(specifier.text, filePath);
    if (resolved) {
      dependencies.push(resolved);
    }
  }
  return dependencies;
}

/**
 * Reads a file and records the size of its code and the relative modules it
 * imports. Cached until the file changes on disk.
 */
function readFileInfo(filePath: string): FileInfo | null {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return null;
  }
  const mtimeMs = stats.mtimeMs;

  const cached = fileCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached;
  }

  // An asset inlined into the bundle, such as an SVG or a raw stylesheet,
  // contributes its bytes as they are and imports nothing.
  if (!CODE_EXTENSIONS.includes(path.extname(filePath))) {
    const info: FileInfo = { mtimeMs, size: stats.size, dependencies: [] };
    fileCache.set(filePath, info);
    return info;
  }

  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    fileCache.set(filePath, null);
    return null;
  }

  const info: FileInfo = {
    mtimeMs,
    size: compiledSize(filePath, source),
    dependencies: collectDependencies(filePath, source)
  };
  fileCache.set(filePath, info);
  return info;
}

/**
 * Sums the code size of a module and of every relative module it statically
 * imports. Returns null when the file cannot be read.
 *
 * Callers which only compare the total against a threshold can pass it as
 * `budget`. The walk then stops as soon as the running total reaches it and
 * returns that partial sum, because a module already over the threshold stays
 * over it however much more its imports hold. The files behind the threshold
 * are never read.
 */
export function getTransitiveCodeSize(
  entry: string,
  budget = Number.POSITIVE_INFINITY
): number | null {
  const root = readFileInfo(entry);
  if (!root) {
    return null;
  }

  const seen = new Set<string>([entry]);
  const queue: Array<{ file: string; depth: number }> = [
    { file: entry, depth: 0 }
  ];
  let total = 0;

  while (queue.length > 0) {
    const { file, depth } = queue.shift()!;
    const info = readFileInfo(file);
    if (!info) {
      // The size is unknown rather than small, and a module which cannot be
      // measured is reported rather than filtered out.
      return null;
    }
    total += info.size;
    if (total >= budget) {
      return total;
    }
    if (depth >= MAX_DEPTH || seen.size >= MAX_FILES) {
      continue;
    }
    for (const dependency of info.dependencies) {
      if (!seen.has(dependency)) {
        seen.add(dependency);
        queue.push({ file: dependency, depth: depth + 1 });
      }
    }
  }
  return total;
}
