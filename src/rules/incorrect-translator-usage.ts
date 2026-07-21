/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { createRule } from '../utils/create-rule';
import { TSESTree } from '@typescript-eslint/types';

/**
 * Methods of the TranslationBundle interface from `@jupyterlab/translation`.
 */
const BUNDLE_METHODS = new Set([
  '__',
  '_n',
  '_p',
  '_np',
  'gettext',
  'ngettext',
  'pgettext',
  'npgettext',
  'dcnpgettext'
]);

/**
 * Property names under which a translation bundle may be stored so that the
 * string extractor recognizes its usages (this.trans, this._trans,
 * this.props.trans, props.trans).
 * See jupyterlab.readthedocs.io/en/stable/extension/internationalization.html#rules
 */
const BUNDLE_PROPERTY_NAMES = new Set(['trans', '_trans']);

/**
 * The only accepted name for a local variable holding a translation bundle.
 */
const BUNDLE_VARIABLE_NAME = 'trans';

/**
 * Skips TypeScript-only and optional-chaining wrapper nodes so the
 * underlying expression can be inspected.
 */
function unwrapExpression(node: TSESTree.Node): TSESTree.Node {
  switch (node.type) {
    case 'ChainExpression':
    case 'TSNonNullExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
      return unwrapExpression(node.expression);
    default:
      return node;
  }
}

/**
 * Returns the object on which `.load(...)` is called when the node is a call
 * of the form `<expr>.load(...)`, or null otherwise.
 */
function getLoadCallObject(node: TSESTree.Node): TSESTree.Node | null {
  const expression = unwrapExpression(node);
  if (
    expression.type === 'CallExpression' &&
    expression.callee.type === 'MemberExpression' &&
    !expression.callee.computed &&
    expression.callee.property.type === 'Identifier' &&
    expression.callee.property.name === 'load'
  ) {
    return expression.callee.object;
  }
  return null;
}

/**
 * Returns true when the expression looks like an ITranslator: an identifier
 * or property whose name contains "translator", e.g. `translator`,
 * `this.translator`, `this._translator`, `props.translator` or
 * `nullTranslator`.
 */
function isTranslatorReference(node: TSESTree.Node): boolean {
  const expression = unwrapExpression(node);
  if (expression.type === 'Identifier') {
    return /translator/i.test(expression.name);
  }
  if (
    expression.type === 'MemberExpression' &&
    !expression.computed &&
    expression.property.type === 'Identifier'
  ) {
    return /translator/i.test(expression.property.name);
  }
  return false;
}

/**
 * Returns true when the node is a `<translator>.load(...)` call producing a
 * translation bundle.
 */
function isTranslatorLoadCall(node: TSESTree.Node): boolean {
  const object = getLoadCallObject(node);
  return object !== null && isTranslatorReference(object);
}

/**
 * Returns true when a member expression names one of the exact targets the
 * string extractor recognizes as a translation bundle:
 * this.trans, this._trans, props.trans, this.props.trans.
 * See jupyterlab.readthedocs.io/en/stable/extension/internationalization.html#rules
 */
function isRecognizedBundleMember(node: TSESTree.MemberExpression): boolean {
  if (node.computed || node.property.type !== 'Identifier') {
    return false;
  }
  const propertyName = node.property.name;
  const object = node.object;

  // this.trans / this._trans
  if (object.type === 'ThisExpression') {
    return BUNDLE_PROPERTY_NAMES.has(propertyName);
  }

  if (propertyName !== BUNDLE_VARIABLE_NAME) {
    return false;
  }

  // props.trans
  if (object.type === 'Identifier' && object.name === 'props') {
    return true;
  }

  // this.props.trans
  return (
    object.type === 'MemberExpression' &&
    !object.computed &&
    object.object.type === 'ThisExpression' &&
    object.property.type === 'Identifier' &&
    object.property.name === 'props'
  );
}

/**
 * Renders a readable dotted path for a member/identifier target, e.g.
 * `options.trans` or `this.bundle`, for use in diagnostic messages.
 */
function getTargetName(node: TSESTree.Node): string {
  const expression = unwrapExpression(node);
  if (expression.type === 'ThisExpression') {
    return 'this';
  }
  if (expression.type === 'Identifier') {
    return expression.name;
  }
  if (
    expression.type === 'MemberExpression' &&
    !expression.computed &&
    expression.property.type === 'Identifier'
  ) {
    return `${getTargetName(expression.object)}.${expression.property.name}`;
  }
  return 'this expression';
}

const incorrectTranslatorUsage = createRule({
  name: 'incorrect-translator-usage',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require translation bundles returned by translator.load() to be stored under an extractor-recognized name (e.g. trans, this.trans, this._trans, props.trans, this.props.trans)',
      url: 'https://eslint-plugin.readthedocs.io/en/latest/rules/incorrect-translator-usage/'
    },
    messages: {
      chainedBundleMethod:
        'Do not call {{ method }}() directly on the result of load(). Store the translation bundle in a variable named trans first, e.g. const trans = translator.load("mydomain"); trans.__("..."). Chained calls are not picked up by the translation string extractor.',
      invalidBundleName:
        'Store the translation bundle in a variable named trans (or a trans/_trans property); strings used through "{{ name }}" will not be picked up by the translation string extractor.',
      destructuredBundle:
        'Do not destructure the result of translator.load(). Store the translation bundle in a variable named trans, e.g. const trans = translator.load("mydomain").'
    },
    schema: []
  },
  defaultOptions: [],

  create(context) {
    function checkIdentifierTarget(target: TSESTree.Identifier): void {
      if (target.name !== BUNDLE_VARIABLE_NAME) {
        context.report({
          node: target,
          messageId: 'invalidBundleName',
          data: { name: target.name }
        });
      }
    }

    return {
      // translator.load('mydomain').__('...')
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          BUNDLE_METHODS.has(callee.property.name) &&
          isTranslatorLoadCall(callee.object)
        ) {
          context.report({
            node,
            messageId: 'chainedBundleMethod',
            data: { method: callee.property.name }
          });
        }
      },

      // const bundle = translator.load('mydomain')
      VariableDeclarator(node) {
        if (!node.init || !isTranslatorLoadCall(node.init)) {
          return;
        }
        if (node.id.type === 'Identifier') {
          checkIdentifierTarget(node.id);
        } else {
          context.report({ node: node.id, messageId: 'destructuredBundle' });
        }
      },

      // bundle = translator.load('mydomain')
      // this.bundle = translator.load('mydomain')
      AssignmentExpression(node) {
        if (node.operator !== '=' || !isTranslatorLoadCall(node.right)) {
          return;
        }
        const left = node.left;
        if (left.type === 'Identifier') {
          checkIdentifierTarget(left);
          return;
        }
        if (left.type === 'MemberExpression') {
          if (left.computed || left.property.type !== 'Identifier') {
            return;
          }
          if (!isRecognizedBundleMember(left)) {
            context.report({
              node: left,
              messageId: 'invalidBundleName',
              data: { name: getTargetName(left) }
            });
          }
          return;
        }
        if (left.type === 'ObjectPattern' || left.type === 'ArrayPattern') {
          context.report({ node: left, messageId: 'destructuredBundle' });
        }
      },

      // function f(bundle = translator.load('mydomain')) {}
      AssignmentPattern(node) {
        if (!isTranslatorLoadCall(node.right)) {
          return;
        }
        if (node.left.type === 'Identifier') {
          checkIdentifierTarget(node.left);
        } else {
          context.report({ node: node.left, messageId: 'destructuredBundle' });
        }
      },

      // class A { bundle = translator.load('mydomain'); }
      PropertyDefinition(node) {
        if (!node.value || !isTranslatorLoadCall(node.value)) {
          return;
        }
        if (node.key.type === 'PrivateIdentifier') {
          // this.#trans is never recognized by the string extractor
          context.report({
            node: node.key,
            messageId: 'invalidBundleName',
            data: { name: `#${node.key.name}` }
          });
          return;
        }
        if (node.computed || node.key.type !== 'Identifier') {
          return;
        }
        if (!BUNDLE_PROPERTY_NAMES.has(node.key.name)) {
          context.report({
            node: node.key,
            messageId: 'invalidBundleName',
            data: { name: node.key.name }
          });
        }
      },

      // { bundle: translator.load('mydomain') }
      Property(node) {
        if (node.computed || !isTranslatorLoadCall(node.value)) {
          return;
        }
        const name =
          node.key.type === 'Identifier'
            ? node.key.name
            : node.key.type === 'Literal' && typeof node.key.value === 'string'
              ? node.key.value
              : null;
        if (name !== null && name !== BUNDLE_VARIABLE_NAME) {
          context.report({
            node: node.key,
            messageId: 'invalidBundleName',
            data: { name }
          });
        }
      }
    };
  }
});

export = incorrectTranslatorUsage;
