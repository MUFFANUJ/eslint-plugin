/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import noUntranslatedString from '../src/rules/no-untranslated-string';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module'
    }
  }
});

ruleTester.run('no-untranslated-string', noUntranslatedString, {
  valid: [
    // --- addCommand: translated values ---
    {
      code: `
        commands.addCommand('file-download', {
          label: trans.__('Download'),
          execute: () => {}
        });
      `
    },
    {
      code: `
        commands.addCommand('file-download', {
          label: () => trans.__('Download'),
          execute: () => {}
        });
      `
    },
    {
      code: `
        commands.addCommand('file-download', {
          label: trans.__('Save'),
          caption: trans.__('Save notebook'),
          execute: () => {}
        });
      `
    },
    // --- addCommand: non-literal values ---
    {
      code: `
        commands.addCommand('file-download', {
          label: someVar,
          execute: () => {}
        });
      `
    },
    // --- addCommand: empty strings ---
    {
      code: `
        commands.addCommand('file-download', {
          label: '',
          execute: () => {}
        });
      `
    },
    // --- setAttribute: translated values ---
    { code: `el.setAttribute('aria-label', trans.__('main sidebar'));` },
    { code: `el.setAttribute('title', trans.__('Close Tab'));` },
    // --- direct property assignment: translated ---
    { code: `el.title = trans.__('Close Tab');` },
    { code: `el.ariaLabel = trans.__('Search results');` },
    // --- title.label / title.caption: translated ---
    { code: `this.title.label = trans.__('Source');` },
    { code: `this.title.caption = trans.__('Source file');` },
    // --- showDialog: translated options ---
    {
      code: `
        showDialog({
          title: trans.__('Build Recommended'),
          body,
          buttons: [Dialog.cancelButton(), Dialog.okButton({ label: trans.__('Build') })]
        });
      `
    },
    // --- new Dialog: translated options ---
    {
      code: `
        const dialog = new Dialog({
          title: trans.__('Select Kernel'),
          body,
          buttons
        });
      `
    },

    // --- Dialog button builders: translated label ---
    { code: `Dialog.okButton({ label: trans.__('Build') });` }
  ],

  invalid: [
    // --- addCommand: raw string in label ---
    {
      code: `
        commands.addCommand('file-download', {
          label: 'Download',
          execute: () => {}
        });
      `,
      errors: [
        { messageId: 'untranslatedCommandProp', data: { prop: 'label' } }
      ]
    },
    // --- addCommand: raw string in caption ---
    {
      code: `
        commands.addCommand('file-save', {
          caption: 'Save file',
          execute: () => {}
        });
      `,
      errors: [
        { messageId: 'untranslatedCommandProp', data: { prop: 'caption' } }
      ]
    },
    // --- addCommand: raw string in usage ---
    {
      code: `
        commands.addCommand('filebrowser:open', {
          usage: 'Opens the file browser',
          execute: () => {}
        });
      `,
      errors: [
        { messageId: 'untranslatedCommandProp', data: { prop: 'usage' } }
      ]
    },
    // --- addCommand: concise arrow returning raw string ---
    {
      code: `
        commands.addCommand(CommandIDs.close, {
          label: () => 'Close Tab',
          execute: () => {}
        });
      `,
      errors: [
        { messageId: 'untranslatedCommandProp', data: { prop: 'label' } }
      ]
    },
    // --- addCommand: template literal ---
    {
      code: `
        commands.addCommand('file-download', {
          label: \`Download\`,
          execute: () => {}
        });
      `,
      errors: [
        { messageId: 'untranslatedCommandProp', data: { prop: 'label' } }
      ]
    },
    // --- setAttribute: raw string with aria-label ---
    {
      code: `el.setAttribute('aria-label', 'main sidebar');`,
      errors: [
        { messageId: 'untranslatedSetAttribute', data: { attr: 'aria-label' } }
      ]
    },
    // --- setAttribute: raw string with title ---
    {
      code: `el.setAttribute('title', 'Close Tab');`,
      errors: [
        { messageId: 'untranslatedSetAttribute', data: { attr: 'title' } }
      ]
    },
    // --- setAttribute: template literal ---
    {
      code: `el.setAttribute('aria-label', \`main sidebar\`);`,
      errors: [
        { messageId: 'untranslatedSetAttribute', data: { attr: 'aria-label' } }
      ]
    },

    // --- direct property assignment: raw string to title ---
    {
      code: `el.title = 'Close Tab';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'title' } }
      ]
    },
    // --- direct property assignment: raw string to ariaLabel ---
    {
      code: `el.ariaLabel = 'Search results';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'ariaLabel' } }
      ]
    },
    // --- title.label: raw string ---
    {
      code: `this.title.label = 'Source';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'label' } }
      ]
    },
    // --- title.label: arbitrary receiver ---
    {
      code: `widget.title.label = 'My Panel';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'label' } }
      ]
    },
    // --- title.caption: raw string ---
    {
      code: `this.title.caption = 'Source file';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'caption' } }
      ]
    },
    // --- showDialog: raw string title ---
    {
      code: `showDialog({ title: 'Confirm' });`,
      errors: [
        { messageId: 'untranslatedDialogOption', data: { prop: 'title' } }
      ]
    },
    // --- showDialog: raw string body ---
    {
      code: `showDialog({ title: trans.__('Build'), body: 'Are you sure?' });`,
      errors: [
        { messageId: 'untranslatedDialogOption', data: { prop: 'body' } }
      ]
    },
    // --- new Dialog: raw string title ---
    {
      code: `const d = new Dialog({ title: 'Select Kernel', body });`,
      errors: [
        { messageId: 'untranslatedDialogOption', data: { prop: 'title' } }
      ]
    },

    // --- Dialog button builders: raw string label ---
    {
      code: `Dialog.okButton({ label: 'Build' });`,
      errors: [{ messageId: 'untranslatedDialogButtonLabel' }]
    }
  ]
});

// checkProperties tests
ruleTester.run(
  'no-untranslated-string (checkProperties)',
  noUntranslatedString,
  {
    valid: [
      // Translated
      { code: `const field = new MyField({ label: trans.__('My field') });` },
      // Non-literal
      { code: `const field = new MyField({ label: someVar });` },
      // Empty
      { code: `const field = new MyField({ label: '' });` },
      // Shorthand is a reference, not a literal
      { code: `const opts = { label };` },
      // Computed keys are not tracked
      { code: `const opts = { [label]: 'My field' };` },
      // Property names outside the list are ignored
      { code: `const opts = { id: 'my-id', className: 'my-class' };` },
      { code: `const opts = { label: '-' };` },
      // An empty list disables the check
      {
        code: `const opts = { label: 'My field' };`,
        options: [{ checkProperties: [] }]
      },
      // A custom list replaces the default one
      {
        code: `const opts = { label: 'My field' };`,
        options: [{ checkProperties: ['caption'] }]
      }
    ],
    invalid: [
      // A `label` on an arbitrary constructor
      {
        code: `
          const field = new MyField({
            factory,
            label: 'My field',
            translator: translator
          });
        `,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      // Plain object literal
      {
        code: `const opts = { label: 'My field' };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      // `category` is checked by default too
      {
        code: `launcher.add({ command, category: 'Notebook' });`,
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'category' } }
        ]
      },
      // Quoted key
      {
        code: `const opts = { 'label': 'My field' };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      // Template literal and concise arrow function
      {
        code: `const opts = { label: \`My field\` };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      {
        code: `const opts = { label: () => 'My field' };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      // Nested properties are all reported
      {
        code: `const opts = { label: 'Outer', child: { label: 'Inner' } };`,
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'label' } },
          { messageId: 'untranslatedProperty', data: { prop: 'label' } }
        ]
      },
      // A custom list replaces the default one
      {
        code: `const opts = { label: 'My field', caption: 'My caption' };`,
        options: [{ checkProperties: ['caption'] }],
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'caption' } }
        ]
      },
      // More specific branches still win, without duplicate reports
      {
        code: `
          commands.addCommand('file-download', {
            label: 'Download',
            execute: () => {}
          });
        `,
        errors: [
          { messageId: 'untranslatedCommandProp', data: { prop: 'label' } }
        ]
      },
      {
        code: `Dialog.okButton({ label: 'Build' });`,
        errors: [{ messageId: 'untranslatedDialogButtonLabel' }]
      }
    ]
  }
);

// checkProperties applied to assignment targets
ruleTester.run('no-untranslated-string (assignments)', noUntranslatedString, {
  valid: [
    { code: `widget.label = trans.__('Save');` },
    { code: `this.label = trans.__('Save');` },
    { code: `node.textContent = trans.__('Save');` },
    { code: `img.alt = trans.__('A diagram');` },
    // Not in the default list
    { code: `el.className = 'my-class';` },
    { code: `el.id = 'my-id';` },
    { code: `item.textContent = '/';` },
    { code: `title.textContent = '-';` },
    { code: `anchor.textContent = '¶';` },
    { code: `widget.label = ' … ';` },
    // An empty list disables the check
    { code: `widget.label = 'Save';`, options: [{ checkProperties: [] }] },
    // Dropping `label` also drops the Lumino widget title check
    {
      code: `widget.title.label = 'Source';`,
      options: [{ checkProperties: ['title'] }]
    },
    // A custom list replaces the default one
    {
      code: `widget.label = 'Save';`,
      options: [{ checkProperties: ['textContent'] }]
    },
    // Compound assignment is not a plain assignment
    { code: `el.textContent += 'Save';` }
  ],
  invalid: [
    {
      code: `widget.label = 'Save';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'label' } }
      ]
    },
    {
      code: `this.label = 'Save';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'label' } }
      ]
    },
    {
      code: `node.textContent = 'Save';`,
      errors: [
        {
          messageId: 'untranslatedPropertyAssign',
          data: { prop: 'textContent' }
        }
      ]
    },
    {
      code: `img.alt = 'A diagram';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'alt' } }
      ]
    },
    // A custom list replaces the default one
    {
      code: `el.placeholder = 'Search';`,
      options: [{ checkProperties: ['placeholder'] }],
      errors: [
        {
          messageId: 'untranslatedPropertyAssign',
          data: { prop: 'placeholder' }
        }
      ]
    },
    // Lumino widget titles fall out of `label` / `caption` being listed
    {
      code: `widget.title.label = 'Source';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'label' } }
      ]
    },
    {
      code: `widget.title.caption = 'Source file';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'caption' } }
      ]
    }
  ]
});

// enforcePunctuation applies to every position, not just JSX
ruleTester.run(
  'no-untranslated-string (enforcePunctuation)',
  noUntranslatedString,
  {
    valid: [
      // Blank strings stay ignored even with enforcePunctuation on
      {
        code: `item.textContent = '';`,
        options: [{ enforcePunctuation: true }]
      },
      {
        code: `const opts = { label: '   ' };`,
        options: [{ enforcePunctuation: true }]
      }
    ],
    invalid: [
      {
        code: `item.textContent = '/';`,
        options: [{ enforcePunctuation: true }],
        errors: [
          {
            messageId: 'untranslatedPropertyAssign',
            data: { prop: 'textContent' }
          }
        ]
      },
      {
        code: `const opts = { label: '-' };`,
        options: [{ enforcePunctuation: true }],
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      {
        code: `commands.addCommand('sep', { label: '-', execute: () => {} });`,
        options: [{ enforcePunctuation: true }],
        errors: [
          { messageId: 'untranslatedCommandProp', data: { prop: 'label' } }
        ]
      }
    ]
  }
);

// JSX tests require a separate tester with JSX parsing enabled
const jsxRuleTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    }
  }
});

jsxRuleTester.run('no-untranslated-string (JSX)', noUntranslatedString, {
  valid: [
    // --- JSX: translated expression ---
    { code: `const el = <span>{trans.__('Error message:')}</span>;` },
    {
      code: `
        const el = (
          <button title={visible ? trans.__('Hide layer') : trans.__('Show layer')} />
        );
      `
    },
    {
      code: `const el = (\n  <div>\n    <span>{trans.__('Label')}</span>\n  </div>\n);`
    },
    { code: `<div className={'normal-class-string'} />` },
    { code: `<div id={'my-id'} />` },
    { code: `<span aria-label={trans.__('Close')} />` },
    // Punctuation-only JSX text should not be flagged
    { code: `<span>,</span>` },
    { code: `<span>{' + '}</span>` }
  ],

  invalid: [
    // --- JSXText: raw text content ---
    {
      code: `const el = <span>Hello world</span>;`,
      errors: [{ messageId: 'untranslatedJsxText' }]
    },
    // --- JSXExpressionContainer: raw string literal ---
    {
      code: `const el = <span>{'raw string'}</span>;`,
      errors: [{ messageId: 'untranslatedJsxText' }]
    },
    // --- JSX accessibility attributes must be translated ---
    {
      code: `<button aria-label={'Close dialog'} />`,
      errors: [
        { messageId: 'untranslatedJsxAttribute', data: { prop: 'aria-label' } }
      ]
    },
    {
      code: `<div title={'My tooltip'} />`,
      errors: [
        { messageId: 'untranslatedJsxAttribute', data: { prop: 'title' } }
      ]
    },
    {
      code: `<span aria-description={'Describes something'} />`,
      errors: [
        {
          messageId: 'untranslatedJsxAttribute',
          data: { prop: 'aria-description' }
        }
      ]
    },
    {
      code: `<span aria-description="Describes something" />`,
      errors: [
        {
          messageId: 'untranslatedJsxAttribute',
          data: { prop: 'aria-description' }
        }
      ]
    },
    {
      code: `<button title={visible ? 'Hide layer' : 'Show layer'} />`,
      errors: [
        { messageId: 'untranslatedJsxAttribute', data: { prop: 'title' } },
        { messageId: 'untranslatedJsxAttribute', data: { prop: 'title' } }
      ]
    }
  ]
});

// checkProperties applied to JSX attributes
jsxRuleTester.run(
  'no-untranslated-string (JSX attributes)',
  noUntranslatedString,
  {
    valid: [
      { code: `<MyCheckbox label={trans.__('Enable feature')} />` },
      // An empty list disables the check
      {
        code: `<MyCheckbox label="Enable feature" />`,
        options: [{ checkProperties: [] }]
      },
      // A custom list replaces the default one
      {
        code: `<MyCheckbox label="Enable feature" />`,
        options: [{ checkProperties: ['placeholder'] }]
      }
    ],
    invalid: [
      {
        code: `<MyCheckbox label="Enable feature" />`,
        errors: [
          { messageId: 'untranslatedJsxAttribute', data: { prop: 'label' } }
        ]
      },
      {
        code: `<MyCheckbox label={'Enable feature'} />`,
        errors: [
          { messageId: 'untranslatedJsxAttribute', data: { prop: 'label' } }
        ]
      },
      // A custom list replaces the default one
      {
        code: `<MyInput placeholder="Search" label="Enable feature" />`,
        options: [{ checkProperties: ['placeholder'] }],
        errors: [
          {
            messageId: 'untranslatedJsxAttribute',
            data: { prop: 'placeholder' }
          }
        ]
      }
    ]
  }
);

// enforcePunctuation option tests
jsxRuleTester.run(
  'no-untranslated-string (JSX, enforcePunctuation)',
  noUntranslatedString,
  {
    valid: [
      // Empty strings still ignored even with enforcePunctuation
      { code: `<span>{''}</span>`, options: [{ enforcePunctuation: true }] }
    ],
    invalid: [
      // Punctuation-only JSX text flagged when enforcePunctuation: true
      {
        code: `<div>,</div>`,
        options: [{ enforcePunctuation: true }],
        errors: [{ messageId: 'untranslatedJsxText' }]
      },
      {
        code: `<span>{' - '}</span>`,
        options: [{ enforcePunctuation: true }],
        errors: [{ messageId: 'untranslatedJsxText' }]
      },
      {
        code: `<span>{'.'}</span>`,
        options: [{ enforcePunctuation: true }],
        errors: [{ messageId: 'untranslatedJsxText' }]
      }
    ]
  }
);

// One list drives every generic position, so a name never applies in one
// place but not another
ruleTester.run(
  'no-untranslated-string (one list, every position)',
  noUntranslatedString,
  {
    valid: [
      { code: `el.setAttribute('alt', trans.__('A diagram'));` },
      // Removing a name removes it from every position at once
      {
        code: `
          img.alt = 'A diagram';
          el.setAttribute('alt', 'A diagram');
          const opts = { alt: 'A diagram' };
        `,
        options: [{ checkProperties: [] }]
      }
    ],
    invalid: [
      // `alt` used to report on assignment only
      {
        code: `el.setAttribute('alt', 'A diagram');`,
        errors: [
          { messageId: 'untranslatedSetAttribute', data: { attr: 'alt' } }
        ]
      },
      {
        code: `const opts = { alt: 'A diagram' };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'alt' } }]
      },
      // `placeholder` is checked by default
      {
        code: `input.placeholder = 'Search files';`,
        errors: [
          {
            messageId: 'untranslatedPropertyAssign',
            data: { prop: 'placeholder' }
          }
        ]
      },
      {
        code: `InputDialog.getText({ placeholder: 'Enter WMS URL' });`,
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'placeholder' } }
        ]
      },
      // `tooltip` is common across the ecosystem
      {
        code: `const opts = { icon, tooltip: 'Run all cells' };`,
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'tooltip' } }
        ]
      },
      {
        code: `button.tooltip = 'Run all cells';`,
        errors: [
          { messageId: 'untranslatedPropertyAssign', data: { prop: 'tooltip' } }
        ]
      },
      // `innerText` is handled like `textContent`
      {
        code: `node.innerText = 'Save';`,
        errors: [
          {
            messageId: 'untranslatedPropertyAssign',
            data: { prop: 'innerText' }
          }
        ]
      },
      // `title` is checked in plain object literals too
      {
        code: `const format = { id: 'csv', title: 'Comma separated values' };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'title' } }]
      }
    ]
  }
);

// Hyphenated and camelCase spellings of a name are the same entry
ruleTester.run('no-untranslated-string (name spelling)', noUntranslatedString, {
  valid: [
    // Listing only `label` leaves the aria names alone in every spelling
    {
      code: `
        el.ariaLabel = 'Search results';
        el.setAttribute('aria-label', 'Search results');
      `,
      options: [{ checkProperties: ['label'] }]
    }
  ],
  invalid: [
    // The default list spells it `aria-label`; the DOM property matches too
    {
      code: `el.ariaLabel = 'Search results';`,
      errors: [
        { messageId: 'untranslatedPropertyAssign', data: { prop: 'ariaLabel' } }
      ]
    },
    // ... and a camelCase entry matches the hyphenated attribute
    {
      code: `el.setAttribute('aria-label', 'Search results');`,
      options: [{ checkProperties: ['ariaLabel'] }],
      errors: [
        { messageId: 'untranslatedSetAttribute', data: { attr: 'aria-label' } }
      ]
    }
  ]
});

// TypeScript wrappers around a literal do not hide it
ruleTester.run(
  'no-untranslated-string (TypeScript wrappers)',
  noUntranslatedString,
  {
    valid: [{ code: `const o = { label: trans.__('Save') as string };` }],
    invalid: [
      {
        code: `const o = { label: 'Save' as const };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      {
        code: `widget.label = 'Save' as string;`,
        errors: [
          { messageId: 'untranslatedPropertyAssign', data: { prop: 'label' } }
        ]
      },
      {
        code: `el.setAttribute('title', <string>'Close Tab');`,
        errors: [
          { messageId: 'untranslatedSetAttribute', data: { attr: 'title' } }
        ]
      }
    ]
  }
);

// Conditional branches in monitored positions are checked independently
ruleTester.run(
  'no-untranslated-string (conditional expressions)',
  noUntranslatedString,
  {
    valid: [
      {
        code: `
          const opts = {
            label: visible ? trans.__('Hide layer') : trans.__('Show layer')
          };
        `
      },
      { code: `const opts = { label: visible ? '-' : '1970' };` },
      { code: `const opts = { id: visible ? 'Hide layer' : 'Show layer' };` },
      {
        code: `const opts = { label: options.label ?? trans.__('Untitled') };`
      },
      { code: `el.title = open ? trans.__('Open') : trans.__('Closed');` },
      // No branch is a literal
      { code: `const opts = { label: visible ? hideLabel : showLabel };` },
      // Blank branches are never reported
      { code: `const opts = { label: visible ? '' : '' };` },
      // `'Save' && other` evaluates to `other`, so the left operand is never
      // the displayed value
      { code: `const opts = { label: 'Save' && other };` }
    ],
    invalid: [
      {
        code: `
          const opts = {
            label: visible ? 'Hide layer' : 'Show layer'
          };
        `,
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'label' } },
          { messageId: 'untranslatedProperty', data: { prop: 'label' } }
        ]
      },
      {
        code: `widget.title = visible ? 'Hide layer' : trans.__('Show layer');`,
        errors: [
          { messageId: 'untranslatedPropertyAssign', data: { prop: 'title' } }
        ]
      },
      {
        code: `
          commands.addCommand('toggle-layer', {
            label: () => visible ? 'Hide layer' : 'Show layer',
            execute: () => {}
          });
        `,
        errors: [
          { messageId: 'untranslatedCommandProp', data: { prop: 'label' } },
          { messageId: 'untranslatedCommandProp', data: { prop: 'label' } }
        ]
      },
      {
        code: `showDialog({ title: visible ? 'Hide layer' : 'Show layer' });`,
        errors: [
          { messageId: 'untranslatedDialogOption', data: { prop: 'title' } },
          { messageId: 'untranslatedDialogOption', data: { prop: 'title' } }
        ]
      },
      // A conditional written straight into addCommand, not behind an arrow
      {
        code: `commands.addCommand('layer-toggle', { label: visible ? 'Hide layer' : 'Show layer' });`,
        errors: [
          { messageId: 'untranslatedCommandProp', data: { prop: 'label' } },
          { messageId: 'untranslatedCommandProp', data: { prop: 'label' } }
        ]
      },
      // Half translated, in either direction
      {
        code: `const opts = { label: visible ? 'Hide' : trans.__('Show') };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      {
        code: `const opts = { label: visible ? trans.__('Hide') : 'Show' };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      // Assignment target
      {
        code: `el.title = open ? 'Open' : 'Closed';`,
        errors: [
          { messageId: 'untranslatedPropertyAssign', data: { prop: 'title' } },
          { messageId: 'untranslatedPropertyAssign', data: { prop: 'title' } }
        ]
      },
      // setAttribute value
      {
        code: `el.setAttribute('aria-label', open ? 'Open' : 'Closed');`,
        errors: [
          {
            messageId: 'untranslatedSetAttribute',
            data: { attr: 'aria-label' }
          },
          {
            messageId: 'untranslatedSetAttribute',
            data: { attr: 'aria-label' }
          }
        ]
      },
      // Nested conditionals reach every branch
      {
        code: `const opts = { label: a ? 'One' : b ? 'Two' : 'Three' };`,
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'label' } },
          { messageId: 'untranslatedProperty', data: { prop: 'label' } },
          { messageId: 'untranslatedProperty', data: { prop: 'label' } }
        ]
      },
      // Fallbacks
      {
        code: `const opts = { label: name ?? 'Untitled' };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      {
        code: `const opts = { label: name || 'Untitled' };`,
        errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
      },
      // `&&` displays its right operand
      {
        code: `node.textContent = loading && 'Loading';`,
        errors: [
          {
            messageId: 'untranslatedPropertyAssign',
            data: { prop: 'textContent' }
          }
        ]
      },
      // A TypeScript cast between the operator and its operand
      {
        code: `commands.addCommand('pause', { label: args => (args.filter as string) || 'Breakpoints on exception' });`,
        errors: [
          { messageId: 'untranslatedCommandProp', data: { prop: 'label' } }
        ]
      },
      // A branch holding a concise arrow
      {
        code: `const opts = { label: dynamic ? () => 'Hide' : 'Show' };`,
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'label' } },
          { messageId: 'untranslatedProperty', data: { prop: 'label' } }
        ]
      },
      // Template literals in a branch count as raw strings
      {
        code: 'const opts = { label: visible ? `Hide` : `Show` };',
        errors: [
          { messageId: 'untranslatedProperty', data: { prop: 'label' } },
          { messageId: 'untranslatedProperty', data: { prop: 'label' } }
        ]
      },
      // The literal is reported, not the conditional that holds it
      {
        code: `const opts = { label: visible ? 'Hide' : 'Show' };`,
        errors: [
          {
            messageId: 'untranslatedProperty',
            data: { prop: 'label' },
            type: 'Literal',
            column: 33,
            endColumn: 39
          },
          {
            messageId: 'untranslatedProperty',
            data: { prop: 'label' },
            type: 'Literal',
            column: 42,
            endColumn: 48
          }
        ]
      }
    ]
  }
);

// Conditionals in JSX
jsxRuleTester.run(
  'no-untranslated-string (JSX conditionals)',
  noUntranslatedString,
  {
    valid: [
      { code: `<span>{empty ? trans.__('None') : trans.__('Some')}</span>` },
      { code: `<div className={active ? 'on' : 'off'} />` },
      // A branch holding an element rather than a string
      { code: `<div>{visible ? <Panel /> : null}</div>` }
    ],
    invalid: [
      // Half translated
      {
        code: `<button title={visible ? 'Hide layer' : trans.__('Show layer')} />`,
        errors: [
          { messageId: 'untranslatedJsxAttribute', data: { prop: 'title' } }
        ]
      },
      // Between tags
      {
        code: `<span>{empty ? 'No files' : 'Some files'}</span>`,
        errors: [
          { messageId: 'untranslatedJsxText' },
          { messageId: 'untranslatedJsxText' }
        ]
      },
      // `&&` rendering
      {
        code: `<span>{loading && 'Loading'}</span>`,
        errors: [{ messageId: 'untranslatedJsxText' }]
      },
      // A string next to an element
      {
        code: `<div>{visible ? <Panel /> : 'Nothing to show'}</div>`,
        errors: [{ messageId: 'untranslatedJsxText' }]
      }
    ]
  }
);

// The literal is reported, not the wrapper that holds it
ruleTester.run(
  'no-untranslated-string (report location)',
  noUntranslatedString,
  {
    valid: [],
    invalid: [
      {
        code: `const opts = { label: () => 'My field' };`,
        errors: [
          {
            messageId: 'untranslatedProperty',
            data: { prop: 'label' },
            type: 'Literal',
            column: 29,
            endColumn: 39
          }
        ]
      },
      {
        code: `const opts = { label: 'My field' as const };`,
        errors: [
          {
            messageId: 'untranslatedProperty',
            data: { prop: 'label' },
            type: 'Literal',
            column: 23,
            endColumn: 33
          }
        ]
      }
    ]
  }
);

// Bare numbers are never flagged, with or without enforcePunctuation
ruleTester.run('no-untranslated-string (numbers)', noUntranslatedString, {
  valid: [
    { code: `const opts = { label: '1970' };` },
    { code: `node.textContent = '100%';` },
    { code: `node.textContent = '3.14';` },
    {
      code: `const opts = { label: '1970' };`,
      options: [{ enforcePunctuation: true }]
    },
    // A number next to punctuation is still a number
    {
      code: `node.textContent = '1 / 2';`,
      options: [{ enforcePunctuation: true }]
    }
  ],
  invalid: [
    // One letter is enough to make it text again
    {
      code: `node.textContent = '3 items';`,
      errors: [
        {
          messageId: 'untranslatedPropertyAssign',
          data: { prop: 'textContent' }
        }
      ]
    },
    {
      code: `const opts = { label: 'Top 10' };`,
      errors: [{ messageId: 'untranslatedProperty', data: { prop: 'label' } }]
    }
  ]
});

// JSX shares the same list
jsxRuleTester.run(
  'no-untranslated-string (JSX, one list)',
  noUntranslatedString,
  {
    valid: [{ code: `<img alt={trans.__('A diagram')} />` }],
    invalid: [
      // `alt` used to report on assignment only
      {
        code: `<img alt="A diagram" />`,
        errors: [
          { messageId: 'untranslatedJsxAttribute', data: { prop: 'alt' } }
        ]
      },
      {
        code: `<ToolbarButton tooltip="Run all cells" />`,
        errors: [
          { messageId: 'untranslatedJsxAttribute', data: { prop: 'tooltip' } }
        ]
      },
      {
        code: `<input placeholder="Search files" />`,
        errors: [
          {
            messageId: 'untranslatedJsxAttribute',
            data: { prop: 'placeholder' }
          }
        ]
      },
      // A camelCase entry matches the hyphenated JSX attribute
      {
        code: `<span aria-label="Close" />`,
        options: [{ checkProperties: ['ariaLabel'] }],
        errors: [
          {
            messageId: 'untranslatedJsxAttribute',
            data: { prop: 'aria-label' }
          }
        ]
      }
    ]
  }
);
