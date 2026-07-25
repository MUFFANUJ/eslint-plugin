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
  isInJupyterPluginActivate,
  isOuterFunctionScopeVariable,
  markManagedDisposableUse,
  PendingDisposableMap,
  shouldCheckReturnedDisposable
} from '../utils/disposables';

interface RuleOptions {
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
            default: DEFAULT_OWNERSHIP_FUNCTION_NAMES,
            description:
              'Function or method names that take ownership of a disposable argument.'
          },
          ignoredReturnFunctionNames: {
            type: 'array',
            items: { type: 'string' },
            default: DEFAULT_IGNORED_RETURN_FUNCTION_NAMES,
            description:
              'Function or method names whose disposable return value is intentionally ignored.'
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

    const ignoredReturnFunctionNamesOption = (options as RuleOptions)
      .ignoredReturnFunctionNames;
    const ignoredReturnFunctionNames = new Set(
      ignoredReturnFunctionNamesOption ?? DEFAULT_IGNORED_RETURN_FUNCTION_NAMES
    );

    function isIgnoredReturn(node: TSESTree.CallExpression): boolean {
      if (
        ignoredReturnFunctionNamesOption === undefined &&
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
        (ignoredReturnFunctionNamesOption === undefined &&
          isDefaultIgnoredFactoryReturnFunctionName(name))
      );
    }

    const ownership: DisposableOwnershipContext = {
      sourceCode: context.sourceCode,
      checker,
      services,
      ownershipFunctionNames: new Set(
        (options as RuleOptions).ownershipFunctionNames ??
          DEFAULT_OWNERSHIP_FUNCTION_NAMES
      )
    };

    return {
      CallExpression(node) {
        markManagedDisposableUse(pending, node, ownership);

        if (
          isInJupyterPluginActivate(node, ownership) ||
          isIgnoredReturn(node) ||
          !shouldCheckReturnedDisposable(node) ||
          isDisposableExpressionManaged(node, ownership)
        ) {
          return;
        }

        if (
          ignoredReturnFunctionNamesOption === undefined &&
          !isLikelyDisposableFactoryCall(node)
        ) {
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
            )
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
