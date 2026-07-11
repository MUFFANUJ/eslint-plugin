/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { TSESTree } from '@typescript-eslint/types';
import { ParserServices, TSESLint } from '@typescript-eslint/utils';
import * as ts from 'typescript';

const DISPOSABLE_INTERFACE_NAMES = ['IDisposable', 'IObservableDisposable'];

const DISPOSABLE_CONSTRUCTOR_NAMES = [
  'DisposableDelegate',
  'ObservableDisposableDelegate',
  'DisposableSet',
  'ObservableDisposableSet'
];

const DISPOSABLE_SET_NAMES = ['DisposableSet', 'ObservableDisposableSet'];

interface PendingDisposable {
  node: TSESTree.Node;
}

export interface DisposableOwnershipContext {
  sourceCode: TSESLint.SourceCode;
  checker: ts.TypeChecker | null;
  services: ParserServices | null;
  ownershipFunctionNames: Set<string>;
}

export type PendingDisposableMap = Map<
  TSESLint.Scope.Variable,
  PendingDisposable[]
>;

function getStaticMemberName(node: TSESTree.MemberExpression): string | null {
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  if (
    node.computed &&
    node.property.type === 'Literal' &&
    typeof node.property.value === 'string'
  ) {
    return node.property.value;
  }
  return null;
}

export function getCalleeName(node: TSESTree.Node): string | null {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'MemberExpression') {
    return getStaticMemberName(node);
  }
  return null;
}

function getTransparentChild(node: TSESTree.Node): TSESTree.Node | null {
  if (
    node.type === 'ChainExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TSNonNullExpression'
  ) {
    return node.expression;
  }
  return null;
}

function getOuterExpression(node: TSESTree.Node): TSESTree.Node {
  let current = node;
  let parent = current.parent;
  while (parent) {
    const child = getTransparentChild(parent);
    if (child !== current) {
      break;
    }
    current = parent;
    parent = current.parent;
  }
  return current;
}

function isStaticMemberCall(
  node: TSESTree.CallExpression,
  name: string
): boolean {
  return (
    node.callee.type === 'MemberExpression' &&
    getStaticMemberName(node.callee) === name
  );
}

function isOwnershipFunctionCall(
  node: TSESTree.CallExpression,
  ownership: DisposableOwnershipContext
): boolean {
  const name = getCalleeName(node.callee);
  return name !== null && ownership.ownershipFunctionNames.has(name);
}

function getReceiverName(node: TSESTree.Node): string | null {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'
  ) {
    return node.property.name;
  }
  return null;
}

function isLikelyDisposableSet(node: TSESTree.Node): boolean {
  const name = getReceiverName(node);
  return name === 'disposables' || name === '_disposables';
}

function isLikelyDisposableProperty(node: TSESTree.Node): boolean {
  const name = getReceiverName(node);
  return name === 'disposablesProperty';
}

export function isDisposableConstructor(node: TSESTree.NewExpression): boolean {
  const name = getCalleeName(node.callee);
  return name !== null && DISPOSABLE_CONSTRUCTOR_NAMES.includes(name);
}

export function isDisposableSetFactoryCall(node: TSESTree.Node): boolean {
  if (
    node.type !== 'CallExpression' ||
    node.callee.type !== 'MemberExpression' ||
    getStaticMemberName(node.callee) !== 'from'
  ) {
    return false;
  }

  const name = getCalleeName(node.callee.object);
  return name !== null && DISPOSABLE_SET_NAMES.includes(name);
}

function isDirectArrayArgument(
  element: TSESTree.ArrayExpression['elements'][number]
): element is TSESTree.Expression {
  return element !== null && element.type !== 'SpreadElement';
}

function getDisposableSetFactoryArguments(
  node: TSESTree.CallExpression
): TSESTree.CallExpressionArgument[] {
  if (!isDisposableSetFactoryCall(node)) {
    return [];
  }

  const [items] = node.arguments;
  if (!items || items.type !== 'ArrayExpression') {
    return [];
  }

  return items.elements.filter(isDirectArrayArgument);
}

function resolveVariable(
  sourceCode: TSESLint.SourceCode,
  identifier: TSESTree.Identifier
): TSESLint.Scope.Variable | null {
  let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier);
  while (scope) {
    const variable = scope.set.get(identifier.name);
    if (variable) {
      return variable;
    }
    scope = scope.upper;
  }
  return null;
}

function getIdentifierVariable(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.Node | null | undefined
): TSESLint.Scope.Variable | null {
  if (!node) {
    return null;
  }
  if (node.type === 'Identifier') {
    return resolveVariable(sourceCode, node);
  }
  const child = getTransparentChild(node);
  if (child) {
    return getIdentifierVariable(sourceCode, child);
  }
  return null;
}

export function addPendingDisposable(
  pending: PendingDisposableMap,
  variable: TSESLint.Scope.Variable,
  node: TSESTree.Node
): void {
  const records = pending.get(variable) ?? [];
  records.push({ node });
  pending.set(variable, records);
}

function markDisposableManaged(
  pending: PendingDisposableMap,
  variable: TSESLint.Scope.Variable | null
): void {
  if (!variable) {
    return;
  }
  const records = pending.get(variable);
  if (!records) {
    return;
  }

  records.pop();
  if (records.length === 0) {
    pending.delete(variable);
  }
}

export function getAssignedVariable(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode
): TSESLint.Scope.Variable | null {
  const expression = getOuterExpression(node);
  const parent = expression.parent;
  if (!parent) {
    return null;
  }
  if (
    parent.type === 'VariableDeclarator' &&
    parent.init === expression &&
    parent.id.type === 'Identifier'
  ) {
    const declaredVariables = sourceCode.getDeclaredVariables(parent);
    return declaredVariables[0] ?? null;
  }
  if (
    parent.type === 'AssignmentExpression' &&
    parent.right === expression &&
    parent.left.type === 'Identifier'
  ) {
    return resolveVariable(sourceCode, parent.left);
  }
  return null;
}

function isFunctionLike(node: TSESTree.Node): boolean {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression'
  );
}

function isConditionalOrRepeated(node: TSESTree.Node): boolean {
  return (
    node.type === 'CatchClause' ||
    node.type === 'ConditionalExpression' ||
    node.type === 'DoWhileStatement' ||
    node.type === 'ForInStatement' ||
    node.type === 'ForOfStatement' ||
    node.type === 'ForStatement' ||
    node.type === 'IfStatement' ||
    node.type === 'SwitchCase' ||
    node.type === 'SwitchStatement' ||
    node.type === 'TryStatement' ||
    node.type === 'WhileStatement'
  );
}

function isUnconditionalUse(
  node: TSESTree.Node,
  variable: TSESLint.Scope.Variable
): boolean {
  const scopeBlock = variable.scope.block;
  let parent = node.parent;

  while (parent) {
    if (parent === scopeBlock) {
      return true;
    }
    if (isFunctionLike(parent) || isConditionalOrRepeated(parent)) {
      return false;
    }
    parent = parent.parent;
  }

  return false;
}

function hasTypeName(
  type: ts.Type,
  checker: ts.TypeChecker,
  names: readonly string[]
): boolean {
  const apparentType = checker.getApparentType(type);
  const symbols = [
    type.aliasSymbol,
    type.getSymbol(),
    apparentType.aliasSymbol,
    apparentType.getSymbol()
  ];

  return symbols.some(symbol => {
    if (!symbol) {
      return false;
    }
    return names.includes(symbol.getName());
  });
}

function isDisposableSetType(
  node: TSESTree.Node,
  ownership: DisposableOwnershipContext
): boolean {
  if (!ownership.checker || !ownership.services) {
    return false;
  }

  try {
    const tsNode = ownership.services.esTreeNodeToTSNodeMap.get(node);
    const type = ownership.checker.getTypeAtLocation(tsNode);
    return hasTypeName(type, ownership.checker, DISPOSABLE_SET_NAMES);
  } catch {
    return false;
  }
}

function isAttachedPropertyType(
  node: TSESTree.Node,
  ownership: DisposableOwnershipContext
): boolean {
  if (!ownership.checker || !ownership.services) {
    return false;
  }

  try {
    const tsNode = ownership.services.esTreeNodeToTSNodeMap.get(node);
    const type = ownership.checker.getTypeAtLocation(tsNode);
    return hasTypeName(type, ownership.checker, ['AttachedProperty']);
  } catch {
    return false;
  }
}

function isOwnershipAddCall(
  node: TSESTree.CallExpression,
  ownership: DisposableOwnershipContext
): boolean {
  if (
    !isStaticMemberCall(node, 'add') ||
    node.callee.type !== 'MemberExpression'
  ) {
    return false;
  }

  return (
    isDisposableSetType(node.callee.object, ownership) ||
    isLikelyDisposableSet(node.callee.object)
  );
}

function isOwnershipSetCall(
  node: TSESTree.CallExpression,
  ownership: DisposableOwnershipContext
): boolean {
  if (
    !isStaticMemberCall(node, 'set') ||
    node.callee.type !== 'MemberExpression'
  ) {
    return false;
  }

  return (
    isAttachedPropertyType(node.callee.object, ownership) ||
    isLikelyDisposableProperty(node.callee.object)
  );
}

function getOwnershipArguments(
  node: TSESTree.CallExpression,
  ownership: DisposableOwnershipContext
): TSESTree.CallExpressionArgument[] {
  if (isOwnershipAddCall(node, ownership)) {
    return node.arguments;
  }

  if (isDisposableSetFactoryCall(node)) {
    return getDisposableSetFactoryArguments(node);
  }

  if (isOwnershipFunctionCall(node, ownership)) {
    return node.arguments;
  }

  if (isOwnershipSetCall(node, ownership)) {
    return node.arguments.slice(1);
  }

  return [];
}

export function isDisposableExpressionManaged(
  node: TSESTree.Node,
  ownership: DisposableOwnershipContext
): boolean {
  const expression = getOuterExpression(node);
  const parent = expression.parent;
  if (!parent) {
    return false;
  }

  if (parent.type === 'ReturnStatement' && parent.argument === expression) {
    return true;
  }

  if (parent.type === 'ArrowFunctionExpression' && parent.body === expression) {
    return true;
  }

  if (
    parent.type === 'AssignmentExpression' &&
    parent.right === expression &&
    parent.left.type === 'MemberExpression'
  ) {
    return true;
  }

  if (parent.type === 'PropertyDefinition' && parent.value === expression) {
    return true;
  }

  if (parent.type === 'CallExpression') {
    return getOwnershipArguments(parent, ownership).includes(
      expression as TSESTree.CallExpressionArgument
    );
  }

  if (
    parent.type === 'ArrayExpression' &&
    parent.parent?.type === 'CallExpression'
  ) {
    return getOwnershipArguments(parent.parent, ownership).includes(
      expression as TSESTree.CallExpressionArgument
    );
  }

  if (
    parent.type === 'MemberExpression' &&
    parent.object === expression &&
    getStaticMemberName(parent) === 'dispose' &&
    parent.parent?.type === 'CallExpression' &&
    parent.parent.callee === parent
  ) {
    return true;
  }

  return false;
}

export function markManagedDisposableUse(
  pending: PendingDisposableMap,
  node: TSESTree.Node,
  ownership: DisposableOwnershipContext
): void {
  if (node.type === 'ReturnStatement') {
    const variable = getIdentifierVariable(ownership.sourceCode, node.argument);
    if (variable && isUnconditionalUse(node, variable)) {
      markDisposableManaged(pending, variable);
    }
    return;
  }

  if (node.type === 'AssignmentExpression') {
    if (node.left.type === 'MemberExpression') {
      const variable = getIdentifierVariable(ownership.sourceCode, node.right);
      if (variable && isUnconditionalUse(node, variable)) {
        markDisposableManaged(pending, variable);
      }
    }
    return;
  }

  if (node.type !== 'CallExpression') {
    return;
  }

  const ownershipArguments = getOwnershipArguments(node, ownership);
  if (ownershipArguments.length > 0) {
    for (const argument of ownershipArguments) {
      const variable = getIdentifierVariable(ownership.sourceCode, argument);
      if (variable && isUnconditionalUse(node, variable)) {
        markDisposableManaged(pending, variable);
      }
    }
    return;
  }

  if (
    isStaticMemberCall(node, 'dispose') &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type !== 'Super'
  ) {
    const variable = getIdentifierVariable(
      ownership.sourceCode,
      node.callee.object
    );
    if (variable) {
      if (isUnconditionalUse(node, variable)) {
        markDisposableManaged(pending, variable);
      }
    }
  }
}

function hasDisposableTypeName(
  type: ts.Type,
  checker: ts.TypeChecker
): boolean {
  return (
    hasTypeName(type, checker, DISPOSABLE_INTERFACE_NAMES) ||
    hasTypeName(type, checker, DISPOSABLE_CONSTRUCTOR_NAMES)
  );
}

function declarationHasDisposableHeritage(
  declaration: ts.Declaration
): boolean {
  if (
    !(
      ts.isClassDeclaration(declaration) ||
      ts.isClassExpression(declaration) ||
      ts.isInterfaceDeclaration(declaration)
    )
  ) {
    return false;
  }

  return (
    declaration.heritageClauses?.some(clause =>
      clause.types.some(type => {
        const text = type.expression.getText();
        for (const name of DISPOSABLE_INTERFACE_NAMES) {
          if (text === name || text.endsWith(`.${name}`)) {
            return true;
          }
        }
        for (const name of DISPOSABLE_CONSTRUCTOR_NAMES) {
          if (text === name || text.endsWith(`.${name}`)) {
            return true;
          }
        }
        return false;
      })
    ) ?? false
  );
}

function hasDisposableHeritage(type: ts.Type): boolean {
  const symbol = type.getSymbol();
  return symbol?.declarations?.some(declarationHasDisposableHeritage) ?? false;
}

function hasDisposableShape(type: ts.Type, checker: ts.TypeChecker): boolean {
  const dispose = type.getProperty('dispose');
  const isDisposed = type.getProperty('isDisposed');
  if (!dispose || !isDisposed) {
    return false;
  }

  const declaration = dispose.valueDeclaration ?? dispose.declarations?.[0];
  if (!declaration) {
    return false;
  }

  const disposeType = checker.getTypeOfSymbolAtLocation(dispose, declaration);
  return disposeType.getCallSignatures().length > 0;
}

export function isDisposableType(
  type: ts.Type,
  checker: ts.TypeChecker,
  seen = new Set<ts.Type>()
): boolean {
  if (seen.has(type)) {
    return false;
  }
  seen.add(type);

  if (type.isUnion()) {
    return type.types.some(part => isDisposableType(part, checker, seen));
  }

  if (type.isIntersection()) {
    return type.types.some(part => isDisposableType(part, checker, seen));
  }

  const apparentType = checker.getApparentType(type);

  return (
    hasDisposableTypeName(type, checker) ||
    hasDisposableHeritage(type) ||
    hasDisposableShape(apparentType, checker)
  );
}

export function shouldCheckReturnedDisposable(
  node: TSESTree.CallExpression
): boolean {
  const expression = getOuterExpression(node);
  const parent = expression.parent;
  if (!parent) {
    return false;
  }

  if (
    parent.type === 'ExpressionStatement' ||
    parent.type === 'ReturnStatement'
  ) {
    return true;
  }

  if (parent.type === 'VariableDeclarator' && parent.init === expression) {
    return true;
  }

  if (parent.type === 'AssignmentExpression' && parent.right === expression) {
    return true;
  }

  if (parent.type === 'PropertyDefinition' && parent.value === expression) {
    return true;
  }

  if (
    parent.type === 'UnaryExpression' &&
    parent.operator === 'void' &&
    parent.argument === expression
  ) {
    return true;
  }

  if (parent.type === 'CallExpression' || parent.type === 'NewExpression') {
    return parent.arguments.includes(
      expression as TSESTree.CallExpressionArgument
    );
  }

  if (
    parent.type === 'ArrayExpression' &&
    (parent.parent?.type === 'CallExpression' ||
      parent.parent?.type === 'NewExpression') &&
    parent.parent.arguments.includes(parent as TSESTree.CallExpressionArgument)
  ) {
    return true;
  }

  return parent.type === 'MemberExpression' && parent.object === expression;
}
