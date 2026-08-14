/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule';
import {
  extractStaticSelectorText,
  isLikelyPageExpression,
  matchSelectorInteraction,
  SelectorInteractionMatch
} from '../utils/playwright-selectors';

type MessageIds = 'preferSidebarHelper' | 'preferActivityHelper';
type Options = [];

interface SelectorSource {
  node: TSESTree.Expression;
  kind: 'selector' | 'title';
  value: string;
}

const SIDEBAR_TITLE_TO_ID = new Map<string, string>([
  ['Debugger', 'jp-debugger-sidebar'],
  ['Extension Manager', 'extensionmanager.main-view'],
  ['File Browser', 'filebrowser'],
  ['Property Inspector', 'jp-property-inspector'],
  ['Running Terminals and Kernels', 'jp-running-sessions'],
  ['Sessions and Tabs', 'jp-running-sessions'],
  ['Table of Contents', 'table-of-contents']
]);

const ACTION_METHODS = new Set(['click', 'tap']);
const TITLE_ATTRIBUTE_PATTERN =
  /\[\s*title\s*=\s*(?:"([^"]+)"|'([^']+)')\s*\]/g;
const MAIN_AREA_PATTERN =
  /(?:^|[\s>])(?:div)?\s*\[\s*role\s*=\s*(?:"main"|'main'|main)\s*\]/;
const TEXT_SELECTOR_PATTERN =
  /(?:^|>>)\s*text\s*=\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*(?:$|>>)/;
const ACTIVITY_TAB_SELECTOR_PATTERN =
  /(?:\[\s*role\s*=\s*(?:"tab"|'tab'|tab)\s*\]|\.lm-TabBar-tab(?:\b|[.:[\s>])|\.lm-TabBar-tabLabel(?:\b|[.:[\s>]))/;
const FILE_LIKE_ACTIVITY_NAME_PATTERN = /\.[A-Za-z0-9][\w-]*(?:\s*\*)?$/;

function getSelectorSource(
  match: SelectorInteractionMatch
): SelectorSource | null {
  if (!ACTION_METHODS.has(match.interactionMethod) || match.isRightClick) {
    return null;
  }

  if (match.selectorParts.length !== 1) {
    return null;
  }

  const [part] = match.selectorParts;
  const selector = extractStaticSelectorText(part.argNode, {
    allowPartialTemplate: false
  });
  if (selector === null) {
    return null;
  }

  return {
    node: part.argNode,
    kind: part.method === 'getByTitle' ? 'title' : 'selector',
    value: selector
  };
}

function findSidebarTitle(
  source: SelectorSource
): { title: string; id: string } | null {
  if (source.kind === 'title') {
    const id = SIDEBAR_TITLE_TO_ID.get(source.value);
    return id ? { title: source.value, id } : null;
  }

  for (const match of source.value.matchAll(TITLE_ATTRIBUTE_PATTERN)) {
    const title = match[1] ?? match[2];
    const id = SIDEBAR_TITLE_TO_ID.get(title);
    if (id) {
      return { title, id };
    }
  }

  return null;
}

function getActivityTabName(source: SelectorSource): string | null {
  if (source.kind !== 'selector' || !MAIN_AREA_PATTERN.test(source.value)) {
    return null;
  }

  const match = TEXT_SELECTOR_PATTERN.exec(source.value);
  if (!match) {
    return null;
  }

  const tabName = (match[1] ?? match[2] ?? match[3]).trim();
  if (tabName.length === 0) {
    return null;
  }

  if (
    !ACTIVITY_TAB_SELECTOR_PATTERN.test(source.value) &&
    !FILE_LIKE_ACTIVITY_NAME_PATTERN.test(tabName)
  ) {
    return null;
  }

  return tabName;
}

function isGalataHelperImplementation(filename: string): boolean {
  return filename.replace(/\\/g, '/').includes('/galata/src/helpers/');
}

function isCloseSidebarComment(value: string): boolean {
  return /\b(close|closing|collapse|collapsing|hide|hiding)\b/i.test(value);
}

const preferSidebarActivityHelper = createRule<Options, MessageIds>({
  name: 'prefer-sidebar-activity-helper',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer Galata sidebar and activity helpers over raw Playwright tab selectors',
      url: 'https://eslint-plugin.readthedocs.io/en/latest/rules/prefer-sidebar-activity-helper/'
    },
    messages: {
      preferSidebarHelper:
        'Use page.sidebar.openTab("{{ id }}") instead of clicking the "{{ title }}" sidebar tab directly.',
      preferActivityHelper:
        'Use page.activity.activateTab("{{ tabName }}") instead of clicking a main area tab by text.'
    },
    schema: []
  },
  defaultOptions: [],

  create(context) {
    if (isGalataHelperImplementation(context.filename)) {
      return {};
    }

    const sourceCode = context.sourceCode;

    function hasNearbyCloseSidebarComment(node: TSESTree.Node): boolean {
      return sourceCode.getAllComments().some(comment => {
        return (
          comment.loc &&
          node.loc &&
          comment.loc.end.line < node.loc.start.line &&
          comment.loc.end.line >= node.loc.start.line - 2 &&
          isCloseSidebarComment(comment.value)
        );
      });
    }

    function reportSelectorSource(
      source: SelectorSource,
      actionNode: TSESTree.CallExpression
    ): void {
      const sidebar = findSidebarTitle(source);
      if (sidebar) {
        if (hasNearbyCloseSidebarComment(actionNode)) {
          return;
        }

        context.report({
          node: source.node,
          messageId: 'preferSidebarHelper',
          data: sidebar
        });
        return;
      }

      const tabName = getActivityTabName(source);
      if (tabName) {
        context.report({
          node: source.node,
          messageId: 'preferActivityHelper',
          data: { tabName }
        });
      }
    }

    return {
      CallExpression(node) {
        const match = matchSelectorInteraction(node, {
          isPageExpression: isLikelyPageExpression
        });
        const source = match ? getSelectorSource(match) : null;
        if (source) {
          reportSelectorSource(source, node);
        }
      }
    };
  }
});

export = preferSidebarActivityHelper;
