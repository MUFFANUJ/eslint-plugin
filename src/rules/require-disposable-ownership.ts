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
  isDisposableConstructor,
  isDisposableExpressionManaged,
  isDisposableType,
  isInJupyterPluginActivate,
  isOuterFunctionScopeVariable,
  markManagedDisposableUse,
  PendingDisposableMap
} from '../utils/disposables';

interface RuleOptions {
  ownershipFunctionNames?: string[];
}

const requireDisposableOwnership = createRule({
  name: 'require-disposable-ownership',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require newly created IDisposable objects to be owned, returned, assigned to a field, or disposed',
      url: 'https://eslint-plugin.readthedocs.io/en/latest/rules/require-disposable-ownership/'
    },
    messages: {
      unmanagedDisposable:
        'Disposable created here must be owned, returned, assigned to a field, or disposed.',
      unmanagedDisposableVariable:
        'Disposable "{{ name }}" must be owned, returned, assigned to a field, or disposed.'
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

    function isDisposableCreation(node: TSESTree.NewExpression): boolean {
      if (checker && services) {
        try {
          const tsNode = services.esTreeNodeToTSNodeMap.get(node);
          const type = checker.getTypeAtLocation(tsNode);
          if (isDisposableType(type, checker)) {
            return true;
          }
        } catch {
          // Fall back to the known Lumino disposable constructors below.
        }
      }
      return isDisposableConstructor(node);
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
      },

      ReturnStatement(node) {
        markManagedDisposableUse(pending, node, ownership);
      },

      AssignmentExpression(node) {
        markManagedDisposableUse(pending, node, ownership);
      },

      NewExpression(node) {
        markManagedDisposableUse(pending, node, ownership);

        if (isInJupyterPluginActivate(node, ownership)) {
          return;
        }

        if (!isDisposableCreation(node)) {
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

        if (isDisposableExpressionManaged(node, ownership)) {
          return;
        }

        context.report({ node, messageId: 'unmanagedDisposable' });
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

export = requireDisposableOwnership;
