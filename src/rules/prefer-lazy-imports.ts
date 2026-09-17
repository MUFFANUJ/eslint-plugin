/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { TSESTree } from '@typescript-eslint/types';
import {
  ESLintUtils,
  ParserServices,
  TSESLint
} from '@typescript-eslint/utils';
import * as ts from 'typescript';
import {
  looksLikePluginObject,
  typeMentionsJupyterPlugin
} from '../utils/plugin-utils';
import {
  ALWAYS_IGNORED_IMPORTS,
  buildDeferredImportSnippet,
  DEFAULT_ALLOWED_PACKAGES,
  DEFAULT_DEFERRED_PACKAGES,
  DEFAULT_MINIMUM_SIZE,
  isEagerlyReached,
  isInInteractionCallback,
  isInPluginTokenList,
  LazyImportOptions,
  matchesPatterns
} from '../utils/lazy-imports';
import {
  getTransitiveCodeSize,
  resolveRelativeModule
} from '../utils/module-size';
import { getHostProvidedPackages } from '../utils/shared-packages';
import { createRule } from '../utils/create-rule';

const DEFAULT_OPTIONS: LazyImportOptions = {
  allowedPackages: DEFAULT_ALLOWED_PACKAGES,
  deferredPackages: DEFAULT_DEFERRED_PACKAGES,
  ignoreImports: [],
  minimumSize: DEFAULT_MINIMUM_SIZE,
  reportInteractionCallbacks: false,
  reportModuleLevelUsage: false
};

const jupyterPreferLazyImports = createRule<[LazyImportOptions], string>({
  name: 'prefer-lazy-imports',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer deferred imports for heavy dependencies of JupyterLab plugins',
      url: 'https://eslint-plugin.readthedocs.io/en/latest/rules/prefer-lazy-imports/'
    },
    messages: {
      preferLazyImport:
        "'{{ source }}' is imported at the top of a plugin module but only used inside functions, so it loads before the application starts. " +
        'Import it where it is used instead: `{{ snippet }}`',
      eagerModuleLevelUse:
        "'{{ source }}' is used at module level in a plugin module, so it loads before the application starts. " +
        "Move the usage into a function and import it there with `await import('{{ source }}')`.",
      preferLazyImportInteraction:
        "'{{ source }}' is only used inside user-interaction handlers, so it is not needed until the user acts. " +
        'Import it where it is used instead: `{{ snippet }}`',
      deferredPackageImport:
        "'{{ source }}' is in `deferredPackages`, so it must only be loaded with `await import()`, but this static import loads it together with the module. " +
        'Import it where it is used instead: `{{ snippet }}`',
      deferredPackageEagerUse:
        "'{{ source }}' is in `deferredPackages`, so it must only be loaded with `await import()`, but it is used while this module is evaluated. " +
        "Move the usage into a function and import it there with `await import('{{ source }}')`. " +
        'If this module is itself only loaded with `import()`, disable the rule for this import.',
      deferredPackageNotTypeOnly:
        "'{{ source }}' is in `deferredPackages`, and this import has no runtime use, but it is not written as `import type`, so a build with `verbatimModuleSyntax` or plain JavaScript loads the package anyway. " +
        'Remove the import, or make it `import type`.',
      deferredPackageReExport:
        "'{{ source }}' is in `deferredPackages`, so it must only be loaded with `await import()`, but this re-export loads it together with the module. " +
        "Remove the re-export and use `await import('{{ source }}')` where the package is needed."
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedPackages: {
            type: 'array',
            items: { type: 'string' },
            default: DEFAULT_ALLOWED_PACKAGES,
            description:
              'Packages already loaded eagerly by the application, which are therefore free to import at the top of a plugin module. Supports `*` wildcards, and `!` to deny a package whatever else in the list matches it. Replaces the default list.'
          },
          deferredPackages: {
            type: 'array',
            items: { type: 'string' },
            default: DEFAULT_DEFERRED_PACKAGES,
            description:
              'Packages which must only be loaded with `await import()`. A static import of one is reported in every module, however its bindings are used. Matched like `allowedPackages`, takes precedence over it and over the manifest, and replaces the default list.'
          },
          ignoreImports: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description:
              'Import specifiers to skip, matched the same way as `allowedPackages`: `*` wildcards, `!` to deny a specifier whatever else in the list matches it, and a bare specifier tested both as written and against its owning package. For example `./tokens` or `*.css`.'
          },
          minimumSize: {
            type: 'number',
            minimum: 0,
            default: DEFAULT_MINIMUM_SIZE,
            description:
              'Smallest module worth deferring, in bytes of code once comments and type declarations are removed, counted over the module and everything it statically imports by relative path. Set to 0 to report every module regardless of size.'
          },
          reportInteractionCallbacks: {
            type: 'boolean',
            default: false,
            description:
              'Also check modules which do not define a plugin, reporting an import there when every use sits inside a user-interaction handler: a command `execute` implementation, a listener for an interaction event such as `click`, or a JSX handler prop such as `onClick`.'
          },
          reportModuleLevelUsage: {
            type: 'boolean',
            default: false,
            description:
              'Also report imports used at module level, excluding tokens referenced in `requires`, `optional` and `provides`.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  defaultOptions: [DEFAULT_OPTIONS],

  create(context, [options]) {
    const {
      allowedPackages,
      deferredPackages,
      ignoreImports,
      minimumSize,
      reportInteractionCallbacks,
      reportModuleLevelUsage
    } = options;

    let services: ParserServices | null = null;
    let checker: ts.TypeChecker | null = null;

    try {
      services = ESLintUtils.getParserServices(context, true);
      checker = services.program ? services.program.getTypeChecker() : null;
    } catch {
      // Parser services unavailable (non-TS file or no type information)
      services = null;
    }

    const getTSNode = services
      ? (node: TSESTree.Node) => services?.esTreeNodeToTSNodeMap.get(node)
      : null;

    let isPluginModule = false;
    const importDeclarations: TSESTree.ImportDeclaration[] = [];
    // Sources kept in the startup bundle by a value re-export.
    const reExportedSources = new Set<string>();

    function mentionsPluginType(
      typeNode: TSESTree.TypeNode | undefined | null
    ): boolean {
      return typeMentionsJupyterPlugin(typeNode, checker, getTSNode);
    }

    // Packages this extension declares as provided by the application, read
    // from `jupyterlab.sharedPackages` in its own manifest. They extend
    // `allowedPackages` rather than replacing it, and are only looked up once
    // an import turns out to need them.
    let hostProvided: string[] | null = null;

    /**
     * Returns true when the specifier is exempt from the usage check, either
     * because the application loads it eagerly anyway or because it was
     * ignored explicitly.
     */
    function isExempt(source: string): boolean {
      if (
        matchesPatterns(source, ALWAYS_IGNORED_IMPORTS) ||
        matchesPatterns(source, allowedPackages) ||
        matchesPatterns(source, ignoreImports)
      ) {
        return true;
      }
      if (hostProvided === null) {
        hostProvided = getHostProvidedPackages(context.filename);
      }
      return matchesPatterns(source, hostProvided);
    }

    /**
     * Returns true when the package must only be loaded with `import()`. The
     * list wins over `allowedPackages` and the manifest, which describe what
     * the application loads at startup, since this one describes what it
     * keeps out of startup on purpose. `ignoreImports` still wins as the
     * explicit way to skip a specifier, and an asset from such a package is
     * left to the bundler like any other asset.
     */
    function isDeferredPackage(source: string): boolean {
      return (
        matchesPatterns(source, deferredPackages) &&
        !matchesPatterns(source, ALWAYS_IGNORED_IMPORTS) &&
        !matchesPatterns(source, ignoreImports)
      );
    }

    /**
     * Returns true when the module holds too little code for a separate chunk
     * to pay off. Only relative imports can be measured; a package which is not
     * in the shared runtime is bundled into the extension, so it always counts
     * as worth deferring. An unreadable module counts as worth deferring too,
     * so a missing file never hides a finding.
     */
    function isTooSmall(source: string): boolean {
      if (minimumSize <= 0) {
        return false;
      }
      const resolved = resolveRelativeModule(source, context.filename);
      if (!resolved) {
        return false;
      }
      const size = getTransitiveCodeSize(resolved, minimumSize);
      return size !== null && size < minimumSize;
    }

    /**
     * Returns true when an identifier sits inside `typeof X`, which TypeScript
     * erases even though the scope manager records it as a value reference.
     */
    function isInTypeQuery(node: TSESTree.Node): boolean {
      let current: TSESTree.Node | undefined = node;
      while (current && current.type !== 'Program') {
        if (current.type === 'TSTypeQuery') {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * Collects the value references of every runtime binding of an import
     * declaration. Type-only specifiers and type positions are left out
     * because TypeScript erases them.
     */
    function getValueReferences(
      declaration: TSESTree.ImportDeclaration
    ): TSESLint.Scope.Reference[] {
      const references: TSESLint.Scope.Reference[] = [];
      for (const specifier of declaration.specifiers) {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind === 'type'
        ) {
          continue;
        }
        for (const variable of context.sourceCode.getDeclaredVariables(
          specifier
        )) {
          for (const reference of variable.references) {
            // `isValueReference` comes from the typescript-eslint scope
            // manager. Under the default parser there are no type references,
            // so every reference is a value reference.
            const isValue = reference.isValueReference ?? true;
            if (isValue && !isInTypeQuery(reference.identifier)) {
              references.push(reference);
            }
          }
        }
      }
      return references;
    }

    /**
     * Checks every declaration importing one source together. A source pulled
     * in eagerly by any one of them is already in the startup bundle, so
     * deferring the others would not remove it.
     */
    function checkSource(
      source: string,
      declarations: TSESTree.ImportDeclaration[]
    ): void {
      if (isExempt(source) || reExportedSources.has(source)) {
        return;
      }

      const references = declarations.flatMap(getValueReferences);
      if (references.length === 0) {
        // Unused, or used only in type positions which TypeScript erases.
        return;
      }

      // Measuring a module compiles it, which costs far more than the checks
      // below, and most candidates are ruled out by them. The measurement
      // therefore happens at the point of reporting rather than here.
      function reportUnlessTooSmall(
        descriptor: Parameters<typeof context.report>[0]
      ): void {
        if (isTooSmall(source)) {
          return;
        }
        context.report(descriptor);
      }

      if (!isPluginModule) {
        // Outside a plugin module an ordinary function proves nothing, since
        // it may run while the application starts. Only a position which
        // provably waits for the user shows the import can load later.
        if (
          references.every(({ identifier }) =>
            isInInteractionCallback(identifier)
          )
        ) {
          reportUnlessTooSmall({
            node: declarations[0],
            messageId: 'preferLazyImportInteraction',
            data: {
              source,
              snippet: buildDeferredImportSnippet(declarations)
            }
          });
        }
        return;
      }

      let deferrable = 0;
      let eager = 0;
      let tokenList = 0;
      for (const { identifier } of references) {
        if (isInPluginTokenList(identifier)) {
          // A token in `requires`, `optional` or `provides` is read when the
          // plugin is registered, so it can never be deferred.
          tokenList += 1;
        } else if (isEagerlyReached(identifier, context.sourceCode)) {
          eager += 1;
        } else {
          deferrable += 1;
        }
      }

      if (tokenList === 0 && eager === 0 && deferrable > 0) {
        reportUnlessTooSmall({
          node: declarations[0],
          messageId: 'preferLazyImport',
          data: {
            source,
            snippet: buildDeferredImportSnippet(declarations)
          }
        });
        return;
      }

      if (reportModuleLevelUsage && eager > 0 && tokenList === 0) {
        reportUnlessTooSmall({
          node: declarations[0],
          messageId: 'eagerModuleLevelUse',
          data: { source }
        });
      }
    }

    /**
     * Reports a static import of a package which must only be loaded with
     * `import()`. Where the bindings are used makes no difference here: a
     * binding used only inside a function still loads the package together
     * with this module, and whether this module is part of the startup bundle
     * cannot be seen from this file. So the import is reported wherever it
     * appears, and the usage only picks the advice.
     *
     * Only `import type` is exempt, and that never gets here. A value import
     * whose bindings have no runtime use, an inline `type` specifier included,
     * is erased by TypeScript without `verbatimModuleSyntax` but kept with it
     * (`import { type X }` becomes `import {} from '...'`), and JavaScript
     * never erases anything, so it counts as loading the package as well.
     */
    function checkDeferredPackage(
      source: string,
      declarations: TSESTree.ImportDeclaration[]
    ): void {
      // The snippet is built from the declarations with a runtime use, plus a
      // side-effect import, which has nothing to erase. Each of the others is
      // reported on its own line, because deleting the reported declarations
      // would leave it behind, still loading the package under
      // `verbatimModuleSyntax` or in JavaScript.
      const loading: TSESTree.ImportDeclaration[] = [];
      const references: TSESLint.Scope.Reference[] = [];
      for (const declaration of declarations) {
        const own = getValueReferences(declaration);
        if (own.length > 0 || declaration.specifiers.length === 0) {
          loading.push(declaration);
          references.push(...own);
        } else {
          context.report({
            node: declaration,
            messageId: 'deferredPackageNotTypeOnly',
            data: { source }
          });
        }
      }
      if (loading.length === 0) {
        return;
      }

      const eager = references.some(
        ({ identifier }) =>
          isInPluginTokenList(identifier) ||
          isEagerlyReached(identifier, context.sourceCode)
      );
      if (eager) {
        context.report({
          node: loading[0],
          messageId: 'deferredPackageEagerUse',
          data: { source }
        });
        return;
      }
      context.report({
        node: loading[0],
        messageId: 'deferredPackageImport',
        data: { source, snippet: buildDeferredImportSnippet(loading) }
      });
    }

    /**
     * A re-export of a package which must only be loaded with `import()` is a
     * finding in itself, `export { type X } from` included: only `export type`
     * is erased under `verbatimModuleSyntax`, the rest stays as
     * `export {} from '...'` and loads the source. For any other source a
     * value re-export keeps it in the startup bundle, so deferring the
     * matching import would gain nothing and the usage check skips it.
     */
    function checkReExport(
      node: TSESTree.ExportNamedDeclaration | TSESTree.ExportAllDeclaration,
      source: string,
      hasValueSpecifier: boolean
    ): void {
      if (isDeferredPackage(source)) {
        context.report({
          node,
          messageId: 'deferredPackageReExport',
          data: { source }
        });
      } else if (hasValueSpecifier) {
        reExportedSources.add(source);
      }
    }

    return {
      VariableDeclarator(node) {
        if (
          !isPluginModule &&
          node.id.type === 'Identifier' &&
          mentionsPluginType(node.id.typeAnnotation?.typeAnnotation)
        ) {
          isPluginModule = true;
        }
      },
      'TSAsExpression, TSSatisfiesExpression'(
        node: TSESTree.TSAsExpression | TSESTree.TSSatisfiesExpression
      ) {
        if (!isPluginModule && mentionsPluginType(node.typeAnnotation)) {
          isPluginModule = true;
        }
      },
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(
        node:
          | TSESTree.FunctionDeclaration
          | TSESTree.FunctionExpression
          | TSESTree.ArrowFunctionExpression
      ) {
        if (
          !isPluginModule &&
          mentionsPluginType(node.returnType?.typeAnnotation)
        ) {
          isPluginModule = true;
        }
      },
      ObjectExpression(node) {
        if (!isPluginModule && looksLikePluginObject(node)) {
          isPluginModule = true;
        }
      },
      ImportDeclaration(node) {
        if (node.parent.type === 'Program' && node.importKind !== 'type') {
          importDeclarations.push(node);
        }
      },
      ExportNamedDeclaration(node) {
        if (!node.source || node.exportKind === 'type') {
          return;
        }
        checkReExport(
          node,
          node.source.value,
          node.specifiers.some(specifier => specifier.exportKind !== 'type')
        );
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== 'type') {
          checkReExport(node, node.source.value, true);
        }
      },
      'Program:exit'() {
        const bySource = new Map<string, TSESTree.ImportDeclaration[]>();
        for (const declaration of importDeclarations) {
          const source = declaration.source.value;
          const group = bySource.get(source);
          if (group) {
            group.push(declaration);
          } else {
            bySource.set(source, [declaration]);
          }
        }
        // A package which must stay deferred is checked in every module. The
        // usage check needs a plugin module, or the interaction option.
        const checkUsage = isPluginModule || reportInteractionCallbacks;
        for (const [source, declarations] of bySource) {
          if (isDeferredPackage(source)) {
            checkDeferredPackage(source, declarations);
          } else if (checkUsage) {
            // A side-effect import has no binding to move into a function.
            const withBindings = declarations.filter(
              declaration => declaration.specifiers.length > 0
            );
            if (withBindings.length > 0) {
              checkSource(source, withBindings);
            }
          }
        }
      }
    };
  }
});

export = jupyterPreferLazyImports;
