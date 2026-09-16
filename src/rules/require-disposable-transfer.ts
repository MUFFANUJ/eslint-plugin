/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { TSESTree } from '@typescript-eslint/types';
import { ESLintUtils, ParserServices } from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { createRule } from '../utils/create-rule';
import {
  addPendingDisposable,
  DEFAULT_OWNERSHIP_FUNCTION_NAMES,
  DisposableOwnershipContext,
  getAssignedVariable,
  getCalleeName,
  isClassFieldCollectionMutationCall,
  isDisposableExpressionManaged,
  isDisposableSetFactoryCall,
  isDisposableType,
  isDisposedByNestedFunction,
  isExportedVariable,
  isInJupyterPluginActivate,
  isOuterFunctionScopeVariable,
  markManagedDisposableUse,
  PendingDisposableMap,
  resolveNameListOption,
  shouldCheckReturnedDisposable
} from '../utils/disposables';

interface RuleOptions {
  checkAllDisposableReturns?: boolean;
  extendDefaultIgnoredReturnFunctionNames?: boolean;
  extendDefaultOwnershipFunctionNames?: boolean;
  ignoredReturnFunctionNames?: string[];
  ownershipFunctionNames?: string[];
}

const DEFAULT_IGNORED_RETURN_FUNCTION_NAMES = [
  '_adjacentBar',
  '_currentTabBar',
  '_findWidgetByID',
  '_handleNewSession',
  'add',
  'addTab',
  'addCommand',
  'addCommandToolbarButtonClass',
  'addFileType',
  'addGroup',
  'addItem',
  'addKeyBinding',
  'addToolbarButtonClass',
  'addWidgetExtension',
  'contextForWidget',
  'contextMenuWidget',
  'defaultWidgetFactory',
  'delete',
  'find',
  'findWidget',
  'get',
  'getCurrent',
  'getLanguageServerManager',
  'getLogger',
  'getManager',
  'getModelFactory',
  'getWidgetFactory',
  'initializeState',
  'insertCell',
  'insertItem',
  'insertTab',
  'open',
  'openInspector',
  'openOrReveal',
  'pop',
  'popLastModifiedCell',
  'register',
  'registerItem',
  'registerStatusItem',
  'requestCreateSubshell',
  'requestDebug',
  'requestDeleteSubshell',
  'set',
  'shift',
  'widgetAt',
  'widgetRenderer',
  'transform'
];

function isDefaultIgnoredFactoryReturnFunctionName(name: string): boolean {
  return /^add[A-Za-z0-9_$]*Factory$/.test(name);
}

function isLikelyDisposableFactoryCall(node: TSESTree.CallExpression): boolean {
  if (isDisposableSetFactoryCall(node)) {
    return true;
  }

  const name = getCalleeName(node.callee);
  return name !== null && /^(build|create|make|new)[A-Z0-9_$]/.test(name);
}

const requireDisposableTransfer = createRule({
  name: 'require-disposable-transfer',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require calls returning IDisposable to be stored, returned, added to a DisposableSet, or disposed',
      url: 'https://eslint-plugin.readthedocs.io/en/latest/rules/require-disposable-transfer/'
    },
    messages: {
      unhandledDisposable:
        'IDisposable returned from "{{ name }}" must be stored, returned, added to a DisposableSet, or disposed.',
      unmanagedDisposableVariable:
        'IDisposable "{{ name }}" must be returned, added to a DisposableSet, assigned to a field, or disposed.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          ownershipFunctionNames: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Function or method names that take ownership of a disposable argument. Added to the built-in defaults unless extendDefaultOwnershipFunctionNames is false.'
          },
          extendDefaultOwnershipFunctionNames: {
            type: 'boolean',
            default: true,
            description:
              'Whether ownershipFunctionNames extends the built-in defaults. Set to false to replace them, or to drop them entirely when no list is given.'
          },
          ignoredReturnFunctionNames: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Function or method names whose disposable return value is intentionally ignored. Added to the built-in defaults unless extendDefaultIgnoredReturnFunctionNames is false.'
          },
          extendDefaultIgnoredReturnFunctionNames: {
            type: 'boolean',
            default: true,
            description:
              'Whether ignoredReturnFunctionNames extends the built-in defaults, including the add*Factory and this._map.set()/delete() exemptions. Set to false to replace them, or to drop them entirely when no list is given.'
          },
          checkAllDisposableReturns: {
            type: 'boolean',
            default: false,
            description:
              'Check every call whose return type is disposable, not only factory-named calls (create*, build*, make*, new*).'
          }
        },
        additionalProperties: false
      }
    ]
  },
  defaultOptions: [{}],

  create(context, [options]) {
    const pending: PendingDisposableMap = new Map();
    let services: ParserServices | null = null;
    let checker: ts.TypeChecker | null = null;

    try {
      services = ESLintUtils.getParserServices(context, true);
      checker = services.program ? services.program.getTypeChecker() : null;
    } catch {
      services = null;
    }

    function returnsDisposable(node: TSESTree.CallExpression): boolean {
      if (isDisposableSetFactoryCall(node)) {
        return true;
      }

      if (!checker || !services) {
        return false;
      }

      try {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const type = checker.getTypeAtLocation(tsNode);
        return isDisposableType(type, checker);
      } catch {
        return false;
      }
    }

    // The two pattern-based exemptions below (`add*Factory`, and mutating a
    // map-like field of `this`) are part of the built-in defaults, so the same
    // flag that governs the default name list governs them too.
    const extendDefaultIgnoredReturnFunctionNames =
      (options as RuleOptions).extendDefaultIgnoredReturnFunctionNames !==
      false;

    const ignoredReturnFunctionNames = resolveNameListOption(
      (options as RuleOptions).ignoredReturnFunctionNames,
      DEFAULT_IGNORED_RETURN_FUNCTION_NAMES,
      extendDefaultIgnoredReturnFunctionNames
    );

    function isIgnoredReturn(node: TSESTree.CallExpression): boolean {
      if (
        extendDefaultIgnoredReturnFunctionNames &&
        isClassFieldCollectionMutationCall(node, ['delete', 'set'])
      ) {
        return true;
      }

      const name = getCalleeName(node.callee);
      if (!name) {
        return false;
      }
      return (
        ignoredReturnFunctionNames.has(name) ||
        (extendDefaultIgnoredReturnFunctionNames &&
          isDefaultIgnoredFactoryReturnFunctionName(name))
      );
    }

    const checkAllDisposableReturns =
      (options as RuleOptions).checkAllDisposableReturns === true;

    const ownership: DisposableOwnershipContext = {
      sourceCode: context.sourceCode,
      checker,
      services,
      ownershipFunctionNames: resolveNameListOption(
        (options as RuleOptions).ownershipFunctionNames,
        DEFAULT_OWNERSHIP_FUNCTION_NAMES,
        (options as RuleOptions).extendDefaultOwnershipFunctionNames !== false
      )
    };

    return {
      CallExpression(node) {
        markManagedDisposableUse(pending, node, ownership);

        if (
          isInJupyterPluginActivate(node, ownership) ||
          isIgnoredReturn(node) ||
          !shouldCheckReturnedDisposable(node)
        ) {
          return;
        }

        // The name test reads the call itself, while the two tests after it
        // ask the type checker about the callee, so a call this rule would
        // never report is dropped before any of that work happens.
        if (
          !checkAllDisposableReturns &&
          !isLikelyDisposableFactoryCall(node)
        ) {
          return;
        }

        if (isDisposableExpressionManaged(node, ownership)) {
          return;
        }

        if (!returnsDisposable(node)) {
          return;
        }

        const assignedVariable = getAssignedVariable(node, context.sourceCode);
        if (assignedVariable) {
          if (
            isOuterFunctionScopeVariable(
              node,
              assignedVariable,
              context.sourceCode
            ) ||
            isExportedVariable(assignedVariable) ||
            isDisposedByNestedFunction(assignedVariable, ownership)
          ) {
            return;
          }
          addPendingDisposable(pending, assignedVariable, node);
          return;
        }

        context.report({
          node,
          messageId: 'unhandledDisposable',
          data: { name: getCalleeName(node.callee) ?? 'call' }
        });
      },

      ReturnStatement(node) {
        markManagedDisposableUse(pending, node, ownership);
      },

      AssignmentExpression(node) {
        markManagedDisposableUse(pending, node, ownership);
      },

      NewExpression(node) {
        markManagedDisposableUse(pending, node, ownership);
      },

      'Program:exit'() {
        for (const [variable, records] of pending) {
          for (const record of records) {
            context.report({
              node: record.node,
              messageId: 'unmanagedDisposableVariable',
              data: { name: variable.name }
            });
          }
        }
      }
    };
  }
});

export = requireDisposableTransfer;
