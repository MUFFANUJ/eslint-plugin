/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { TSESTree } from '@typescript-eslint/types';
import { TSESLint } from '@typescript-eslint/utils';
import { getObjectProperties, isCallableProperty } from './plugin-utils';

/*
 * The defaults below assume the build that JupyterLab extensions normally use:
 * rspack driven by `@jupyter/builder`, with Module Federation sharing packages
 * between the application and the extensions it loads. Webpack behaves the same
 * way here. A different bundler classifies assets differently, and a different
 * application shares a different set of packages and defers a different set,
 * so `allowedPackages`, `deferredPackages` and `minimumSize` are all
 * configurable.
 */

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

export interface LazyImportOptions {
  allowedPackages: string[];
  deferredPackages: string[];
  ignoreImports: string[];
  minimumSize: number;
  reportInteractionCallbacks: boolean;
  reportModuleLevelUsage: boolean;
}

/**
 * An async chunk carries a few hundred bytes of bundler runtime, so around one
 * kilobyte of code the saving cancels out. The default sits well above that
 * break-even point: across the Jupyter extensions this rule was measured on,
 * four kilobytes reports half as many imports as one kilobyte while still
 * covering 95% of the code which could be deferred.
 */
export const DEFAULT_MINIMUM_SIZE = 4096;

/**
 * Packages shared through Module Federation, which the application therefore
 * loads whether or not a plugin module imports them at the top.
 *
 * This is the singleton list from `jupyterlab/staging/package.json`, minus
 * `@lumino/datagrid` which core itself defers (see `packages/csvviewer`).
 * Entries prefixed with `!` are denied even when another pattern allows them.
 */
export const DEFAULT_ALLOWED_PACKAGES = [
  '@jupyterlab/*',
  '@lumino/*',
  '!@lumino/datagrid',
  '@jupyter/ydoc',
  '@jupyter/react-components',
  '@jupyter/web-components',
  '@codemirror/language',
  '@codemirror/state',
  '@codemirror/view',
  '@lezer/common',
  '@lezer/highlight',
  '@microsoft/fast-element',
  '@microsoft/fast-foundation',
  'react',
  'react-dom',
  'yjs'
];

/**
 * Packages which JupyterLab itself loads only with `import()`, so a static
 * import anywhere in an extension puts them back on the startup path.
 *
 * A subpath such as `@codemirror/legacy-modes/mode/python` matches through its
 * owning package. Entries prefixed with `!` are exempt even when another
 * pattern matches them.
 */
export const DEFAULT_DEFERRED_PACKAGES = [
  '@lumino/datagrid',
  '@codemirror/lang-*',
  '@codemirror/legacy-modes',
  '@codemirror/search',
  '@rjsf/validator-ajv8',
  'mermaid',
  'react-toastify'
];

/**
 * Assets which a bundler turns into a URL or a style side effect rather than
 * into bundled bytes, so deferring the import saves nothing.
 *
 * Images and fonts are `asset/resource` in the builder configuration, so they
 * are always emitted as separate files and the browser fetches them only when
 * they are used. A stylesheet goes through `style-loader`, which applies it
 * when it is imported, so deferring it would change when the styles take
 * effect rather than only what is downloaded.
 *
 * Assets which are inlined into the bundle as text are deliberately absent:
 * `.svg` imported from JavaScript, `.raw.css`, `.md`, `.txt` and `.json` all
 * add their full size to the startup chunk, so they are measured like any
 * other module.
 */
export const ALWAYS_IGNORED_IMPORTS = [
  '*.css',
  // A raw stylesheet is inlined as text, not applied as a style.
  '!*.raw.css',
  '*.scss',
  '*.sass',
  '*.less',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.webp',
  '*.ico',
  '*.avif',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.eot',
  '*.otf',
  '*.wasm',
  '*.html'
];

/**
 * Array and iterable methods which call their callback right away, so a
 * reference inside such a callback still runs at module load.
 */
const IMMEDIATE_CALLBACK_METHODS = new Set([
  'map',
  'forEach',
  'filter',
  'reduce',
  'reduceRight',
  'some',
  'every',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flatMap',
  'sort'
]);

const globCache = new Map<string, RegExp>();

/**
 * Compiles a pattern where `*` matches any run of characters. Everything else
 * is matched literally.
 */
function compileGlob(pattern: string): RegExp {
  let regexp = globCache.get(pattern);
  if (!regexp) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
    regexp = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
    globCache.set(pattern, regexp);
  }
  return regexp;
}

/**
 * Extracts the package name from an import specifier, or null for a relative
 * or absolute path. Subpath imports resolve to their owning package, so
 * `@jupyterlab/services/lib/kernel` gives `@jupyterlab/services`.
 */
function getPackageName(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return null;
  }
  const parts = specifier.split('/');
  if (specifier.startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0] || null;
}

/**
 * Matches an import specifier against a list of glob patterns. The specifier is
 * tested both as written and as its owning package name. A matching `!` pattern
 * denies the specifier regardless of any other match.
 */
export function matchesPatterns(
  specifier: string,
  patterns: string[]
): boolean {
  const packageName = getPackageName(specifier);
  const candidates =
    packageName && packageName !== specifier
      ? [specifier, packageName]
      : [specifier];

  let allowed = false;
  for (const pattern of patterns) {
    const denied = pattern.startsWith('!');
    const regexp = compileGlob(denied ? pattern.slice(1) : pattern);
    if (candidates.some(candidate => regexp.test(candidate))) {
      if (denied) {
        return false;
      }
      allowed = true;
    }
  }
  return allowed;
}

/**
 * Returns true when a call runs its callback argument before returning, as
 * `list.map(fn)`, `Array.from(items, fn)` and `new Promise(fn)` all do.
 */
function invokesItsCallback(
  call: TSESTree.CallExpression | TSESTree.NewExpression
): boolean {
  const callee = call.callee;
  if (call.type === 'NewExpression') {
    return callee.type === 'Identifier' && callee.name === 'Promise';
  }
  if (callee.type !== 'MemberExpression' || callee.computed) {
    return false;
  }
  if (callee.property.type !== 'Identifier') {
    return false;
  }
  if (
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Array' &&
    callee.property.name === 'from'
  ) {
    return true;
  }
  return IMMEDIATE_CALLBACK_METHODS.has(callee.property.name);
}

/**
 * Returns true when the function is called right away where it appears, so its
 * body runs at module load rather than later.
 */
function isImmediatelyInvoked(fn: FunctionNode): boolean {
  const parent = fn.parent;
  if (!parent) {
    return false;
  }
  if (
    (parent.type === 'CallExpression' || parent.type === 'NewExpression') &&
    parent.callee === fn
  ) {
    return true;
  }
  return (
    (parent.type === 'CallExpression' || parent.type === 'NewExpression') &&
    parent.arguments.includes(fn as TSESTree.CallExpressionArgument) &&
    invokesItsCallback(parent)
  );
}

/**
 * Finds the innermost construct which delays the node until after module
 * evaluation: a function which is not called on the spot, or an instance field
 * initializer which waits for construction. Returns null when the node runs
 * while the module is evaluated.
 */
function findDeferringBoundary(
  node: TSESTree.Node
): FunctionNode | 'field' | null {
  let child: TSESTree.Node | undefined = undefined;
  let current: TSESTree.Node | undefined = node;

  while (current) {
    switch (current.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (!isImmediatelyInvoked(current)) {
          return current;
        }
        break;
      case 'PropertyDefinition':
      case 'AccessorProperty':
        // An instance field initializer runs on construction; a static one runs
        // when the class is defined, which is at module load.
        if (!current.static && child === current.value) {
          return 'field';
        }
        break;
      case 'Program':
        return null;
    }
    child = current;
    current = current.parent;
  }
  return null;
}

/**
 * Returns the variable holding a function, for a declaration such as
 * `function run() {}` or `const run = () => {}`. Returns null for a function
 * which is never bound to a name, such as a callback or an object property.
 */
function getFunctionVariable(
  fn: FunctionNode,
  sourceCode: TSESLint.SourceCode
): TSESLint.Scope.Variable | null {
  if (fn.type === 'FunctionDeclaration' && fn.id) {
    return sourceCode.getDeclaredVariables(fn)[0] ?? null;
  }
  const parent = fn.parent;
  if (
    parent?.type === 'VariableDeclarator' &&
    parent.init === fn &&
    parent.id.type === 'Identifier'
  ) {
    return sourceCode.getDeclaredVariables(parent)[0] ?? null;
  }
  return null;
}

const MAX_CALL_DEPTH = 6;

/**
 * Returns true when the node runs while the module is evaluated, either
 * directly or through a named function which is called at module level.
 */
export function isEagerlyReached(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
  seen: Set<TSESTree.Node> = new Set(),
  depth = 0
): boolean {
  const boundary = findDeferringBoundary(node);
  if (boundary === null) {
    return true;
  }
  if (boundary === 'field' || depth >= MAX_CALL_DEPTH || seen.has(boundary)) {
    return false;
  }
  seen.add(boundary);

  const variable = getFunctionVariable(boundary, sourceCode);
  if (!variable) {
    return false;
  }
  return variable.references.some(reference => {
    const identifier = reference.identifier;
    const parent = identifier.parent;
    if (!parent) {
      return false;
    }
    // `run()` and `new Runner()` reach the body directly.
    if (
      (parent.type === 'CallExpression' || parent.type === 'NewExpression') &&
      parent.callee === identifier
    ) {
      return isEagerlyReached(identifier, sourceCode, seen, depth + 1);
    }
    // `run.call(...)` and `run.apply(...)` reach it as well.
    if (
      parent.type === 'MemberExpression' &&
      parent.object === identifier &&
      !parent.computed &&
      parent.property.type === 'Identifier' &&
      (parent.property.name === 'call' || parent.property.name === 'apply') &&
      parent.parent?.type === 'CallExpression' &&
      parent.parent.callee === parent
    ) {
      return isEagerlyReached(parent.parent, sourceCode, seen, depth + 1);
    }
    // `list.map(run)` passes it to something which calls it straight away.
    if (
      (parent.type === 'CallExpression' || parent.type === 'NewExpression') &&
      parent.arguments.includes(
        identifier as TSESTree.CallExpressionArgument
      ) &&
      invokesItsCallback(parent)
    ) {
      return isEagerlyReached(identifier, sourceCode, seen, depth + 1);
    }
    // Passing the function anywhere else does not say when, or whether, it runs.
    return false;
  });
}

/**
 * DOM events which only fire on a user action, so a listener for one of them
 * cannot run while the application starts.
 */
const INTERACTION_EVENTS = new Set([
  'auxclick',
  'click',
  'contextmenu',
  'dblclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
  'keydown',
  'keypress',
  'keyup',
  'change',
  'input',
  'submit',
  'copy',
  'cut',
  'paste',
  'drop',
  'wheel'
]);

/** The same events assigned as DOM `on*` properties. */
const INTERACTION_ON_PROPERTIES = new Set(
  [...INTERACTION_EVENTS].map(event => `on${event}`)
);

/** The same events as JSX handler props. */
const JSX_INTERACTION_HANDLERS = new Set([
  'onAuxClick',
  'onClick',
  'onContextMenu',
  'onDoubleClick',
  'onMouseDown',
  'onMouseUp',
  'onPointerDown',
  'onPointerUp',
  'onTouchStart',
  'onTouchEnd',
  'onKeyDown',
  'onKeyPress',
  'onKeyUp',
  'onChange',
  'onInput',
  'onSubmit',
  'onCopy',
  'onCut',
  'onPaste',
  'onDrop',
  'onWheel'
]);

/**
 * Returns true when a function's own position marks it as a user-interaction
 * handler: a command `execute` implementation, a listener for an interaction
 * event, or a JSX interaction handler prop. Each position requires the
 * function to be the direct value, so a call producing a handler never counts.
 */
function isInteractionHandler(fn: FunctionNode): boolean {
  const parent = fn.parent;
  if (!parent) {
    return false;
  }
  // `execute: () => {}` and `execute() {}` in command options.
  if (
    parent.type === 'Property' &&
    !parent.computed &&
    parent.value === fn &&
    ((parent.key.type === 'Identifier' && parent.key.name === 'execute') ||
      (parent.key.type === 'Literal' && parent.key.value === 'execute'))
  ) {
    return true;
  }
  // `node.addEventListener('click', () => {})`
  if (
    parent.type === 'CallExpression' &&
    parent.callee.type === 'MemberExpression' &&
    !parent.callee.computed &&
    parent.callee.property.type === 'Identifier' &&
    parent.callee.property.name === 'addEventListener' &&
    parent.arguments[1] === fn &&
    parent.arguments[0]?.type === 'Literal' &&
    typeof parent.arguments[0].value === 'string' &&
    INTERACTION_EVENTS.has(parent.arguments[0].value)
  ) {
    return true;
  }
  // `element.onclick = () => {}`
  if (
    parent.type === 'AssignmentExpression' &&
    parent.operator === '=' &&
    parent.right === fn &&
    parent.left.type === 'MemberExpression' &&
    !parent.left.computed &&
    parent.left.property.type === 'Identifier' &&
    INTERACTION_ON_PROPERTIES.has(parent.left.property.name)
  ) {
    return true;
  }
  // `<button onClick={() => {}} />`
  if (
    parent.type === 'JSXExpressionContainer' &&
    parent.parent?.type === 'JSXAttribute' &&
    parent.parent.name.type === 'JSXIdentifier' &&
    JSX_INTERACTION_HANDLERS.has(parent.parent.name.name)
  ) {
    return true;
  }
  return false;
}

/**
 * Returns true when the node sits inside a user-interaction handler, so it
 * cannot run until the user acts, however the module itself is loaded. The
 * closure only exists once the enclosing handler runs, so anything nested
 * deeper inside it waits for the user as well.
 */
export function isInInteractionCallback(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node;
  while (current && current.type !== 'Program') {
    if (
      (current.type === 'FunctionDeclaration' ||
        current.type === 'FunctionExpression' ||
        current.type === 'ArrowFunctionExpression') &&
      isInteractionHandler(current)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

const PLUGIN_LIST_PROPERTIES = new Set(['requires', 'optional', 'provides']);

/**
 * Returns true when an object literal carrying `requires`, `optional` or
 * `provides` is a plugin rather than an unrelated options bag which happens to
 * use one of those names.
 */
function looksLikePluginList(node: TSESTree.ObjectExpression): boolean {
  const properties = getObjectProperties(node);
  if (isCallableProperty(properties.get('activate'))) {
    return true;
  }
  const id = properties.get('id');
  return (
    !!id && id.value.type === 'Literal' && typeof id.value.value === 'string'
  );
}

/**
 * Returns true when the node sits in a plugin's `requires`, `optional` or
 * `provides` entry, where a token has to be referenced at module load.
 */
export function isInPluginTokenList(node: TSESTree.Node): boolean {
  let child: TSESTree.Node | undefined = undefined;
  let current: TSESTree.Node | undefined = node;

  while (current) {
    if (
      current.type === 'Property' &&
      !current.computed &&
      child === current.value
    ) {
      const key = current.key;
      const name =
        key.type === 'Identifier'
          ? key.name
          : key.type === 'Literal' && typeof key.value === 'string'
            ? key.value
            : null;
      if (
        name &&
        PLUGIN_LIST_PROPERTIES.has(name) &&
        current.parent?.type === 'ObjectExpression' &&
        looksLikePluginList(current.parent)
      ) {
        return true;
      }
    }
    if (current.type === 'Program') {
      return false;
    }
    child = current;
    current = current.parent;
  }
  return false;
}

/**
 * Builds the deferred import snippet suggested in the report message, merging
 * every declaration which imports the same source.
 */
export function buildDeferredImportSnippet(
  declarations: TSESTree.ImportDeclaration[]
): string {
  const source = declarations[0].source.value;
  const named: string[] = [];
  let defaultName: string | null = null;
  let namespaceName: string | null = null;
  // A name which is not a plain identifier cannot be destructured as written.
  let unquotable = false;

  for (const declaration of declarations) {
    for (const specifier of declaration.specifiers) {
      if (specifier.type === 'ImportSpecifier') {
        if (specifier.importKind === 'type') {
          continue;
        }
        if (specifier.imported.type !== 'Identifier') {
          unquotable = true;
          continue;
        }
        const imported = specifier.imported.name;
        const entry =
          imported === specifier.local.name
            ? imported
            : `${imported}: ${specifier.local.name}`;
        if (!named.includes(entry)) {
          named.push(entry);
        }
      } else if (specifier.type === 'ImportDefaultSpecifier') {
        defaultName = specifier.local.name;
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaceName = specifier.local.name;
      }
    }
  }

  // A namespace next to other bindings, or a name needing quotes, has no
  // single-line form, so suggest the import itself rather than broken code.
  if (unquotable || (namespaceName && (defaultName || named.length > 0))) {
    return `await import('${source}')`;
  }
  if (namespaceName) {
    return `const ${namespaceName} = await import('${source}');`;
  }
  if (defaultName) {
    named.unshift(`default: ${defaultName}`);
  }
  if (named.length === 0) {
    return `await import('${source}');`;
  }
  return `const { ${named.join(', ')} } = await import('${source}');`;
}
