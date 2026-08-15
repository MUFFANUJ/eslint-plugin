/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from '../src/rules/galata-prefer-sidebar-activity-helper';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module'
    }
  }
});

ruleTester.run('galata-prefer-sidebar-activity-helper', rule, {
  valid: [
    {
      code: `await page.sidebar.openTab('jp-running-sessions');`
    },
    {
      code: `await page.activity.activateTab('Lorenz.ipynb');`
    },
    {
      code: `const tab = page.locator('[title="Property Inspector"]');`
    },
    {
      code: `await expect(page.locator('[title="Property Inspector"]')).toBeVisible();`
    },
    {
      code: `await page.click('[title="Property Inspector"]', { button: 'right' });`
    },
    {
      code: `await page.locator('[title="Property Inspector"]').click({ button: 'right' });`
    },
    {
      code: `await page.dblclick('[title="Property Inspector"]');`
    },
    {
      code: `await page.locator('[title="Property Inspector"]').dblclick();`
    },
    {
      code: `await page.click('[aria-label="Property Inspector"]');`
    },
    {
      code: `await page.click('[title="Some Extension Sidebar"]');`
    },
    {
      code: `await page.click('[title="Sessions and Tabs"]');`
    },
    {
      code: `await dialog.locator('[title="Property Inspector"]').click();`
    },
    {
      code: `await panel.getByTitle('Debugger').click();`
    },
    {
      code: `await page.click('div[role="main"] >> text=Run');`
    },
    {
      code: `await page.click(\`[title="\${sidebarTitle}"]\`);`
    },
    {
      code: `await page.click(\`div[role="main"] >> text=\${name}.ipynb\`);`
    },
    {
      code: `await page.click('[title="Property Inspector"]');`,
      filename: '/workspace/jupyterlab/galata/src/helpers/sidebar.ts'
    }
  ],

  invalid: [
    {
      code: `await page.click('[title="Running Terminals and Kernels"]');`,
      errors: [
        {
          messageId: 'preferSidebarHelper',
          data: {
            title: 'Running Terminals and Kernels',
            id: 'jp-running-sessions'
          }
        }
      ]
    },
    {
      code: `await page.locator('[title="Property Inspector"]').click();`,
      errors: [
        {
          messageId: 'preferSidebarHelper',
          data: {
            title: 'Property Inspector',
            id: 'jp-property-inspector'
          }
        }
      ]
    },
    {
      code: `await page.locator('[title="Table of Contents"]').first().click();`,
      errors: [
        {
          messageId: 'preferSidebarHelper',
          data: {
            title: 'Table of Contents',
            id: 'table-of-contents'
          }
        }
      ]
    },
    {
      code: `await page.getByTitle('Debugger').click();`,
      errors: [
        {
          messageId: 'preferSidebarHelper',
          data: {
            title: 'Debugger',
            id: 'jp-debugger-sidebar'
          }
        }
      ]
    },
    {
      code: `
        // Close the sidebar
        await page.locator('[title="Property Inspector"]').click();
      `,
      errors: [
        {
          messageId: 'preferSidebarHelper',
          data: {
            title: 'Property Inspector',
            id: 'jp-property-inspector'
          }
        }
      ]
    },
    {
      code: `await page.click('div[role="main"] >> text=Lorenz.ipynb');`,
      errors: [
        {
          messageId: 'preferActivityHelper',
          data: { tabName: 'Lorenz.ipynb' }
        }
      ]
    },
    {
      code: `await page.locator('[role="main"] >> text="Notebook.ipynb"').click();`,
      errors: [
        {
          messageId: 'preferActivityHelper',
          data: { tabName: 'Notebook.ipynb' }
        }
      ]
    },
    {
      code: `await page.click('div[role="main"] [role="tab"] >> text=Console 1');`,
      errors: [
        {
          messageId: 'preferActivityHelper',
          data: { tabName: 'Console 1' }
        }
      ]
    }
  ]
});
