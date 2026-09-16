/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { TSESTree } from '@typescript-eslint/types';
import { isAddCommandCall } from '../utils/commands';
import { getObjectProperties } from '../utils/plugin-utils';
import { unwrapExpression } from '../utils/translation';
import { createRule } from '../utils/create-rule';

function hasLetters(str: string): boolean {
  return /\p{L}/u.test(str);
}

/**
 * A raw string literal found behind a value expression, paired with the node
 * that should be reported (the literal itself, never its wrapper).
 */
interface RawString {
  node: TSESTree.Node;
  value: string;
}

/**
 * Returns every raw string a value expression can evaluate to, empty when it
 * can evaluate to none.
 *
 * A conditional has more than one result, and each one reaches the user on its
 * own: `visible ? 'Hide' : 'Show'` displays either branch, `label ?? 'Untitled'`
 * displays either operand. Collecting them all means a half-translated
 * conditional reports only the branch that is still raw.
 */
function getRawStrings(node: TSESTree.Node): RawString[] {
  const inner = unwrapExpression(node);
  switch (inner.type) {
    case 'Literal':
      return typeof inner.value === 'string'
        ? [{ node: inner, value: inner.value }]
        : [];
    case 'TemplateLiteral':
      return inner.expressions.length === 0
        ? [
            {
              node: inner,
              value: inner.quasis.map(q => q.value.cooked ?? '').join('')
            }
          ]
        : [];
    case 'ArrowFunctionExpression':
      return inner.body.type === 'BlockStatement'
        ? []
        : getRawStrings(inner.body);
    case 'ConditionalExpression':
      return [
        ...getRawStrings(inner.consequent),
        ...getRawStrings(inner.alternate)
      ];
    case 'LogicalExpression':
      // `a && 'text'` evaluates to the left operand only when that operand is
      // falsy, and the only falsy string is blank, which this rule never
      // reports. `a || 'text'` and `a ?? 'text'` evaluate to either operand.
      return [
        ...(inner.operator === '&&' ? [] : getRawStrings(inner.left)),
        ...getRawStrings(inner.right)
      ];
    default:
      return [];
  }
}

/**
 * Folds the hyphenated and camelCase spellings of a name together so that a
 * single configured entry covers both, e.g. the `aria-label` attribute and the
 * `ariaLabel` DOM property.
 */
function normalizeName(name: string): string {
  return name.replace(/-/g, '').toLowerCase();
}

function isSetAttributeCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'setAttribute'
  );
}

function isShowDialogCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === 'Identifier' && node.callee.name === 'showDialog';
}

function isDialogConstructor(node: TSESTree.NewExpression): boolean {
  return node.callee.type === 'Identifier' && node.callee.name === 'Dialog';
}

const DIALOG_BUTTON_BUILDERS = [
  'okButton',
  'cancelButton',
  'warnButton',
  'errorButton'
];

function isDialogButtonCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    DIALOG_BUTTON_BUILDERS.includes(node.callee.property.name)
  );
}

// Properties checked only on the call they belong to, because the name alone
// does not imply user-facing text anywhere else.
const MONITORED_COMMAND_PROPS = ['label', 'caption', 'usage'];
const MONITORED_DIALOG_PROPS = ['title', 'body'];

/**
 * Names checked in every generic position: object literal properties, JSX
 * attributes, `setAttribute()` attribute names and assignment targets.
 */
const DEFAULT_CHECK_PROPERTIES = [
  'alt',
  'aria-description',
  'aria-label',
  'caption',
  'category',
  'label',
  'placeholder',
  'title',
  'tooltip',
  'textContent',
  'innerText'
];

interface Options {
  enforcePunctuation?: boolean;
  checkProperties?: string[];
}

type MessageId =
  | 'untranslatedCommandProp'
  | 'untranslatedSetAttribute'
  | 'untranslatedPropertyAssign'
  | 'untranslatedDialogOption'
  | 'untranslatedDialogButtonLabel'
  | 'untranslatedJsxText'
  | 'untranslatedJsxAttribute'
  | 'untranslatedProperty';

/**
 * Returns the static name of a non-computed object property key, or null when
 * the key is computed or not a plain identifier/string.
 */
function getPropertyKeyName(node: TSESTree.Property): string | null {
  if (node.computed) {
    return null;
  }
  if (node.key.type === 'Identifier') {
    return node.key.name;
  }
  if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
    return node.key.value;
  }
  return null;
}

const noUntranslatedString = createRule({
  name: 'no-untranslated-string',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require user-facing string literals to be wrapped in a translation call such as trans.__()',
      url: 'https://eslint-plugin.readthedocs.io/en/latest/rules/no-untranslated-string/'
    },
    messages: {
      untranslatedCommandProp:
        'Command property "{{ prop }}" has an untranslated string literal. Wrap it with trans.__().',
      untranslatedSetAttribute:
        'setAttribute("{{ attr }}", ...) has an untranslated string literal. Wrap the value with trans.__().',
      untranslatedPropertyAssign:
        'Assignment to "{{ prop }}" has an untranslated string literal. Wrap it with trans.__().',
      untranslatedDialogOption:
        'Dialog/showDialog "{{ prop }}" option has an untranslated string literal. Wrap it with trans.__().',
      untranslatedDialogButtonLabel:
        'Dialog button "label" option has an untranslated string literal. Wrap it with trans.__().',
      untranslatedJsxText:
        'JSX text content has an untranslated string literal. Wrap it with {trans.__(...)}',
      untranslatedJsxAttribute:
        'JSX attribute "{{ prop }}" has an untranslated string literal. Wrap it with {trans.__(...)}',
      untranslatedProperty:
        'Property "{{ prop }}" has an untranslated string literal. Wrap it with trans.__().'
    },
    schema: [
      {
        type: 'object',
        properties: {
          enforcePunctuation: { type: 'boolean' },
          checkProperties: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ]
  },
  defaultOptions: [
    {
      enforcePunctuation: false,
      checkProperties: DEFAULT_CHECK_PROPERTIES
    }
  ],

  create(context) {
    const options = context.options[0] as Options | undefined;
    const enforcePunctuation = options?.enforcePunctuation ?? false;
    const checkProperties = new Set(
      (options?.checkProperties ?? DEFAULT_CHECK_PROPERTIES).map(normalizeName)
    );

    function isMonitoredName(name: string): boolean {
      return checkProperties.has(normalizeName(name));
    }

    /**
     * Returns true if the text should be wrapped in a translation call.
     *
     * Blank strings are never reported. A string with no letters is read as a
     * bare number when it has digits ('1970', '100%'), which this rule never
     * reports, and as punctuation otherwise ('/', '-'), which it reports only
     * when `enforcePunctuation` is on.
     */
    function isReportableText(value: string): boolean {
      if (value.trim().length === 0) {
        return false;
      }
      // No letters: a bare number is never reported, punctuation only on request.
      return hasLetters(value) || (enforcePunctuation && !/\p{N}/u.test(value));
    }

    // Literals already reported by a more specific branch (e.g. addCommand or
    // a Dialog button builder), so the generic checks do not duplicate them.
    // Enclosing calls are visited before the properties they contain, so the
    // specific branch always runs first.
    const reportedNodes = new Set<TSESTree.Node>();

    function report(
      node: TSESTree.Node,
      messageId: MessageId,
      data?: Record<string, string>
    ): void {
      reportedNodes.add(node);
      context.report({ node, messageId, data });
    }

    /**
     * Reports every string literal behind `value` that has not been reported
     * already.
     */
    function reportRawString(
      value: TSESTree.Node,
      messageId: MessageId,
      data?: Record<string, string>
    ): void {
      for (const raw of getRawStrings(value)) {
        if (reportedNodes.has(raw.node) || !isReportableText(raw.value)) {
          continue;
        }
        report(raw.node, messageId, data);
      }
    }

    /**
     * Reports a monitored JSX attribute whose value is a raw string.
     */
    function checkJsxAttributeValue(
      attrName: string | null,
      value: TSESTree.Node
    ): void {
      if (!attrName || !isMonitoredName(attrName)) {
        return;
      }
      reportRawString(value, 'untranslatedJsxAttribute', { prop: attrName });
    }

    return {
      CallExpression(node) {
        // Branch A: commands.addCommand(id, { label, caption, usage })
        if (isAddCommandCall(node)) {
          if (node.arguments.length < 2) {
            return;
          }
          const optionsArg = node.arguments[1];
          if (optionsArg.type !== 'ObjectExpression') {
            return;
          }
          const properties = getObjectProperties(optionsArg);
          for (const propName of MONITORED_COMMAND_PROPS) {
            const prop = properties.get(propName);
            if (prop) {
              reportRawString(prop.value, 'untranslatedCommandProp', {
                prop: propName
              });
            }
          }
          return;
        }

        // Branch B: element.setAttribute('aria-label', string)
        if (isSetAttributeCall(node)) {
          if (node.arguments.length < 2) {
            return;
          }
          const attrNameArg = node.arguments[0];
          if (
            attrNameArg.type !== 'Literal' ||
            typeof attrNameArg.value !== 'string' ||
            !isMonitoredName(attrNameArg.value)
          ) {
            return;
          }
          reportRawString(node.arguments[1], 'untranslatedSetAttribute', {
            attr: attrNameArg.value
          });
          return;
        }

        // Branch C: showDialog({ title, body })
        if (isShowDialogCall(node)) {
          if (node.arguments.length < 1) {
            return;
          }
          const optionsArg = node.arguments[0];
          if (optionsArg.type !== 'ObjectExpression') {
            return;
          }
          const properties = getObjectProperties(optionsArg);
          for (const propName of MONITORED_DIALOG_PROPS) {
            const prop = properties.get(propName);
            if (prop) {
              reportRawString(prop.value, 'untranslatedDialogOption', {
                prop: propName
              });
            }
          }
          return;
        }

        // Branch D: Dialog.okButton/cancelButton/warnButton/errorButton({ label })
        if (isDialogButtonCall(node)) {
          if (node.arguments.length < 1) {
            return;
          }
          const optionsArg = node.arguments[0];
          if (optionsArg.type !== 'ObjectExpression') {
            return;
          }
          const properties = getObjectProperties(optionsArg);
          const labelProp = properties.get('label');
          if (labelProp) {
            reportRawString(labelProp.value, 'untranslatedDialogButtonLabel');
          }
        }
      },

      // new Dialog({ title, body })
      NewExpression(node) {
        if (!isDialogConstructor(node)) {
          return;
        }
        if (node.arguments.length < 1) {
          return;
        }
        const optionsArg = node.arguments[0];
        if (optionsArg.type !== 'ObjectExpression') {
          return;
        }
        const properties = getObjectProperties(optionsArg);
        for (const propName of MONITORED_DIALOG_PROPS) {
          const prop = properties.get(propName);
          if (prop) {
            reportRawString(prop.value, 'untranslatedDialogOption', {
              prop: propName
            });
          }
        }
      },

      // Any monitored assignment target: element.title = STRING,
      // widget.label = STRING, this.label = STRING, node.textContent = STRING,
      // and Lumino widget titles such as this.title.label = STRING
      AssignmentExpression(node) {
        if (node.operator !== '=') {
          return;
        }
        const left = node.left;
        if (
          left.type !== 'MemberExpression' ||
          left.computed ||
          left.property.type !== 'Identifier' ||
          !isMonitoredName(left.property.name)
        ) {
          return;
        }
        reportRawString(node.right, 'untranslatedPropertyAssign', {
          prop: left.property.name
        });
      },

      // Any monitored object property: { label: 'raw string' }.
      // Runs after the call-specific branches above, which mark the literals
      // they already reported so a property is never reported twice.
      Property(node) {
        if (node.shorthand) {
          return;
        }
        const keyName = getPropertyKeyName(node);
        if (!keyName || !isMonitoredName(keyName)) {
          return;
        }
        reportRawString(node.value, 'untranslatedProperty', { prop: keyName });
      },

      // Monitored attribute with a plain string: <span aria-label="text" />
      JSXAttribute(node) {
        if (!node.value || node.value.type === 'JSXExpressionContainer') {
          return;
        }
        const attrName =
          node.name.type === 'JSXIdentifier' ? node.name.name : null;
        checkJsxAttributeValue(attrName, node.value);
      },

      // Raw text between JSX tags: <span>Untranslated text</span>
      JSXText(node) {
        if (isReportableText(node.value)) {
          report(node, 'untranslatedJsxText');
        }
      },

      // String literal inside JSX expression: <span>{'raw string'}</span>
      JSXExpressionContainer(node) {
        if (node.expression.type === 'JSXEmptyExpression') {
          return;
        }
        if (node.parent.type === 'JSXAttribute') {
          const attrName =
            node.parent.name.type === 'JSXIdentifier'
              ? node.parent.name.name
              : null;
          checkJsxAttributeValue(attrName, node.expression);
          return;
        }
        reportRawString(node.expression, 'untranslatedJsxText');
      }
    };
  }
});

export = noUntranslatedString;
