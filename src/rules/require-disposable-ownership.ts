/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ESLintUtils, ParserServices } from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { createRule } from '../utils/create-rule';
import {
  addPendingDisposable,
  DEFAULT_OWNERSHIP_FUNCTION_NAMES,
  DisposableOwnershipContext,
  constructsDisposable,
  getAssignedVariable,
  isDisposableExpressionManaged,
  isDisposedByNestedFunction,
  isExportedVariable,
  isInJupyterPluginActivate,
  isOuterFunctionScopeVariable,
  markManagedDisposableUse,
  PendingDisposableMap,
  resolveNameListOption
} from '../utils/disposables';

interface RuleOptions {
  extendDefaultOwnershipFunctionNames?: boolean;
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
            description:
              'Function or method names that take ownership of a disposable argument. Added to the built-in defaults unless extendDefaultOwnershipFunctionNames is false.'
          },
          extendDefaultOwnershipFunctionNames: {
            type: 'boolean',
            default: true,
            description:
              'Whether ownershipFunctionNames extends the built-in defaults. Set to false to replace them, or to drop them entirely when no list is given.'
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

        if (!constructsDisposable(node, ownership)) {
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
