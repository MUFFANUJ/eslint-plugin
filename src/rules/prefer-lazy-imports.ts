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
        'Import it where it is used instead: `{{ snippet }}`'
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
    // the file turns out to need checking.
    let hostProvided: string[] | null = null;

    /**
     * Returns true when the specifier is exempt from the rule, either because
     * the application loads it eagerly anyway or because it was ignored
     * explicitly.
     */
    function isExempt(source: string): boolean {
      return (
        matchesPatterns(source, ALWAYS_IGNORED_IMPORTS) ||
        matchesPatterns(source, allowedPackages) ||
        matchesPatterns(source, hostProvided ?? []) ||
        matchesPatterns(source, ignoreImports)
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
        if (
          node.parent.type === 'Program' &&
          node.importKind !== 'type' &&
          // A side-effect import has no binding to move into a function.
          node.specifiers.length > 0
        ) {
          importDeclarations.push(node);
        }
      },
      ExportNamedDeclaration(node) {
        // A value re-export keeps the source in the startup bundle, so nothing
        // is gained by deferring the import of it.
        if (!node.source || node.exportKind === 'type') {
          return;
        }
        const hasValueSpecifier = node.specifiers.some(
          specifier => specifier.exportKind !== 'type'
        );
        if (hasValueSpecifier) {
          reExportedSources.add(node.source.value);
        }
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== 'type') {
          reExportedSources.add(node.source.value);
        }
      },
      'Program:exit'() {
        if (!isPluginModule && !reportInteractionCallbacks) {
          return;
        }
        hostProvided = getHostProvidedPackages(context.filename);
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
        for (const [source, declarations] of bySource) {
          checkSource(source, declarations);
        }
      }
    };
  }
});

export = jupyterPreferLazyImports;
