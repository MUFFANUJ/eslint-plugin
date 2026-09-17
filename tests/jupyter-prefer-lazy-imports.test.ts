/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import * as path from 'path';
import preferLazyImports from '../src/rules/prefer-lazy-imports';
import { DEFAULT_ALLOWED_PACKAGES } from '../src/utils/lazy-imports';

// Relative imports in these cases resolve against `tests/fixtures`, so the
// rule can measure how much code they hold.
const fixtureFilename = path.join(__dirname, 'fixtures', 'lazy-plugin.ts');

// This directory holds a manifest whose `jupyterlab.sharedPackages` marks
// `@myorg/host-provided` as supplied by the application.
const sharedPkgFilename = path.join(
  __dirname,
  'fixtures',
  'shared-pkg',
  'lazy-plugin.ts'
);

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      tsconfigRootDir: path.resolve(__dirname, '..')
    }
  }
});

const tsxTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
      tsconfigRootDir: path.resolve(__dirname, '..')
    }
  }
});

// The recommended config applies this rule to plain JavaScript, which ESLint
// parses with espree.
const espreeTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
});

// Resolving a renamed type import needs the TypeScript program.
const typeAwareTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      projectService: {
        allowDefaultProject: ['tests/*.ts'],
        defaultProject: 'tsconfig.json'
      },
      tsconfigRootDir: path.resolve(__dirname, '..')
    }
  }
});

espreeTester.run('prefer-lazy-imports (javascript)', preferLazyImports, {
  valid: [
    {
      filename: fixtureFilename,
      code: `
        import { CommandIDs } from './lazy-tiny';
        export default {
          id: 'test:plugin',
          autoStart: true,
          activate: () => CommandIDs.open
        };
      `
    }
  ],
  invalid: [
    // A plugin written in JavaScript is detected by its shape and reported.
    {
      filename: fixtureFilename,
      code: `
        import { HeavyTable } from './lazy-large';
        export default {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new HeavyTable({ rows: 2, columns: 2 })
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    }
  ]
});

typeAwareTester.run('prefer-lazy-imports (type-aware)', preferLazyImports, {
  valid: [],
  invalid: [
    // The plugin type is renamed through an import alias, so only the checker
    // can tell that this file declares a plugin.
    {
      filename: 'tests/type-aware-fixture.ts',
      code: `
        import { JupyterFrontEndPlugin as JFEP } from './fixtures/types';
        import { HeavyWidget } from 'heavy-pkg';
        const plugin: JFEP<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new HeavyWidget()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    }
  ]
});

ruleTester.run('prefer-lazy-imports', preferLazyImports, {
  valid: [
    // Not a plugin module: the rule does not apply.
    {
      code: `
        import { HeavyWidget } from './widget';
        export function makeWidget() {
          return new HeavyWidget();
        }
      `
    },
    // Allowlisted packages are already in the shared runtime.
    {
      code: `
        import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Dialog } from '@jupyterlab/apputils';
        import { Widget } from '@lumino/widgets';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: (app: JupyterFrontEnd) => {
            new Dialog({ body: new Widget() });
          }
        };
        export default plugin;
      `
    },
    // Import used at module level, so the module loads eagerly regardless.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { IMyToken } from './tokens';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          requires: [IMyToken],
          activate: (app, token) => {
            console.log(token);
          }
        };
        export default plugin;
      `
    },
    // Aggregator index: plugin objects are referenced at module level.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import first from './first';
        import second from './second';
        const plugins: JupyterFrontEndPlugin<any>[] = [first, second];
        export default plugins;
      `
    },
    // Type-only imports are erased by TypeScript.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import type { HeavyWidget } from './widget';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => {
            const widget: HeavyWidget | null = null;
            return widget;
          }
        };
      `
    },
    // A specifier marked type-only inside a value import is also erased.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { type HeavyWidget } from './widget';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => {
            const widget: HeavyWidget | null = null;
            return widget;
          }
        };
      `
    },
    // Side-effect imports have no binding to move.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import '../style/index.css';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => {}
        };
      `
    },
    // Already deferred.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: async () => {
            const { HeavyWidget } = await import('./widget');
            return new HeavyWidget();
          }
        };
      `
    },
    // Explicitly ignored specifier.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { CommandIDs } from './commands';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => {
            console.log(CommandIDs.open);
          }
        };
      `,
      options: [
        {
          allowedPackages: ['@jupyterlab/*'],
          ignoreImports: ['./commands'],
          reportModuleLevelUsage: false
        }
      ]
    },
    // A reference inside an immediately invoked callback runs at load time,
    // so there is nothing to defer.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { transform } from 'some-lib';
        const values = [1, 2, 3].map(value => transform(value));
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => {
            console.log(values);
          }
        };
      `
    },
    // A static class field runs when the class is defined, not on construction.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { registry } from 'some-lib';
        class Holder {
          static shared = registry.create();
        }
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Holder()
        };
      `
    },
    // Module level use is allowed unless the strict option is enabled.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { compute } from 'some-lib';
        const value = compute();
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => value
        };
      `
    },
    // A token referenced in `optional` cannot be deferred, even when the
    // plugin object is built inside a factory function.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { ILayoutRestorer } from './layoutrestorer';
        export function createPlugins(): JupyterFrontEndPlugin<void>[] {
          return [
            {
              id: 'test:plugin',
              optional: [ILayoutRestorer],
              activate: (app, restorer) => restorer
            }
          ];
        }
      `
    },
    // One source imported twice: the eager declaration keeps the module in the
    // startup bundle, so the other one has nothing to gain.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { CpuView } from './cpuView';
        import { DEFAULT_CPU_LABEL } from './cpuView';
        const label = DEFAULT_CPU_LABEL;
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => CpuView.create(label)
        };
      `
    },
    // The helper holding the only reference is itself called at module level.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { buildTable } from './table';
        function makeTable() {
          return buildTable();
        }
        const table = makeTable();
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => table
        };
      `
    },
    // The same through two levels of helper.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { buildTable } from './table';
        const inner = () => buildTable();
        function outer() {
          return inner();
        }
        const table = outer();
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => table
        };
      `
    },
    // A value re-export keeps the source in the startup bundle anyway.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { NotebookDiff } from './diff';
        export { NotebookDiff } from './diff';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new NotebookDiff()
        };
      `
    },
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { NotebookDiff } from './diff';
        export * from './diff';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new NotebookDiff()
        };
      `
    },
    // An image or a font becomes a URL once past the bundler's inline limit,
    // so the browser already fetches the large ones on demand. A stylesheet is
    // applied when imported, so deferring it would change behaviour.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import logo from '../style/logo.png';
        import font from '../style/inter.woff2';
        import styles from '../style/index.css';
        import wasmUrl from 'rtree-sql.js/dist/sql-wasm.wasm';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => [logo, font, styles, wasmUrl]
        };
      `
    },
    // The manifest says the application provides this package, so importing it
    // at the top adds nothing to this extension's bundle.
    {
      filename: sharedPkgFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Shared } from '@myorg/host-provided';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Shared()
        };
      `
    },
    // A subpath import resolves to the same package.
    {
      filename: sharedPkgFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Shared } from '@myorg/host-provided/lib/shared';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Shared()
        };
      `
    },
    // `requires` on an unrelated options object does not pin the import.
    // The reference is inside a function, so the import is still reported;
    // this case guards the opposite mistake of suppressing it.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { ILayoutRestorer } from './layoutrestorer';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          optional: [ILayoutRestorer],
          activate: (app, restorer) => restorer
        };
      `
    },
    // A function passed by name to a method which calls it straight away.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { transform } from 'some-lib';
        const makeLabel = (value: number) => transform(value);
        const labels = [1, 2].map(makeLabel);
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => labels
        };
      `
    },
    // A callback given to `new Promise` runs while the module is evaluated.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { connect } from 'some-lib';
        const ready = new Promise(resolve => resolve(connect()));
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => ready
        };
      `
    },
    // `Array.from` calls its mapping function straight away.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { transform } from 'some-lib';
        const values = Array.from([1, 2], value => transform(value));
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => values
        };
      `
    },
    // A helper reached through `.call` at module level runs at module level.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { transform } from 'some-lib';
        function build() {
          return transform(1);
        }
        const value = build.call(null);
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => value
        };
      `
    },
    // `typeof` is erased, so it is not a runtime use which pins the import.
    // The remaining use is deferred, so this one is reported, not suppressed;
    // see the invalid case which pairs with it.
    // `activate` which is not callable is not a plugin, whatever else it has.
    {
      code: `
        import { HeavyWidget } from './widget';
        export default {
          id: 'test:plugin',
          autoStart: true,
          activate: true,
          widget: new HeavyWidget()
        };
      `
    },
    // A partial options object is merged with the defaults, so the packages
    // the application provides stay exempt.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Widget } from '@lumino/widgets';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Widget()
        };
      `,
      options: [{ ignoreImports: ['./nothing'] }]
    },
    // A small icon is inlined into the bundle, but not enough of it to matter.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import icon from './lazy-icon.svg';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => icon
        };
      `
    },
    // A module of identifiers is too small for a separate chunk to pay off.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { CommandIDs } from './lazy-tiny';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => CommandIDs.open
        };
      `
    },
    // Large as source, but nearly everything in it is erased by TypeScript.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { MODE_ID } from './lazy-type-heavy';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => MODE_ID
        };
      `
    },
    // Tokens in requires stay eager even under the strict option.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { IMyToken } from './tokens';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          requires: [IMyToken],
          provides: [IMyToken],
          activate: (app, token) => token
        };
      `,
      options: [
        {
          allowedPackages: ['@jupyterlab/*'],
          ignoreImports: [],
          reportModuleLevelUsage: true
        }
      ]
    }
  ],

  invalid: [
    // The core case: a relative import used only inside activate.
    {
      code: `
        import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyWidget } from './widget';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: (app: JupyterFrontEnd) => {
            app.shell.add(new HeavyWidget(), 'main');
          }
        };
        export default plugin;
      `,
      errors: [
        {
          messageId: 'preferLazyImport',
          data: {
            source: './widget',
            snippet: "const { HeavyWidget } = await import('./widget');"
          }
        }
      ]
    },
    // A non-allowlisted package used only inside a command callback.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import * as vega from 'vega-embed';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: app => {
            app.commands.addCommand('render', {
              execute: () => vega.default('#el', {})
            });
          }
        };
      `,
      errors: [
        {
          messageId: 'preferLazyImport',
          data: {
            source: 'vega-embed',
            snippet: "const vega = await import('vega-embed');"
          }
        }
      ]
    },
    // `@lumino/datagrid` is denied even though `@lumino/*` is allowed. The
    // deferred list is emptied so that the denial alone is under test.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { DataGrid } from '@lumino/datagrid';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new DataGrid()
        };
      `,
      options: [{ deferredPackages: [] }],
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A default import, reported with the matching snippet.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import Editor from './editor';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Editor()
        };
      `,
      errors: [
        {
          messageId: 'preferLazyImport',
          data: {
            source: './editor',
            snippet: "const { default: Editor } = await import('./editor');"
          }
        }
      ]
    },
    // A renamed specifier keeps its alias in the snippet.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyWidget as Heavy } from './widget';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Heavy()
        };
      `,
      errors: [
        {
          messageId: 'preferLazyImport',
          data: {
            source: './widget',
            snippet: "const { HeavyWidget: Heavy } = await import('./widget');"
          }
        }
      ]
    },
    // A plugin written without a type annotation is still a plugin module.
    {
      code: `
        import { HeavyWidget } from './widget';
        export default {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new HeavyWidget()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // An `as` annotation is recognised.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyWidget } from './widget';
        export default {
          id: 'test:plugin',
          activate: () => new HeavyWidget()
        } as JupyterFrontEndPlugin<void>;
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A `satisfies` annotation is recognised too.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyWidget } from './widget';
        export default {
          id: 'test:plugin',
          activate: () => new HeavyWidget()
        } satisfies JupyterFrontEndPlugin<void>;
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A factory function returning a plugin marks the module too.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyWidget } from './widget';
        export function createPlugin(): JupyterFrontEndPlugin<void> {
          return {
            id: 'test:plugin',
            activate: () => new HeavyWidget()
          };
        }
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // Use inside a class method is deferred, so the import can move.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { parse } from 'heavy-parser';
        class Renderer {
          render(source: string) {
            return parse(source);
          }
        }
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Renderer()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // The strict option reports module level use.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { compute } from 'some-lib';
        const value = compute();
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => value
        };
      `,
      options: [
        {
          allowedPackages: ['@jupyterlab/*'],
          ignoreImports: [],
          reportModuleLevelUsage: true
        }
      ],
      errors: [
        {
          messageId: 'eagerModuleLevelUse',
          data: { source: 'some-lib' }
        }
      ]
    },
    // Under the strict option an aggregator index is reported as well.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import first from './first';
        const plugins: JupyterFrontEndPlugin<any>[] = [first];
        export default plugins;
      `,
      options: [
        {
          allowedPackages: ['@jupyterlab/*'],
          ignoreImports: [],
          reportModuleLevelUsage: true
        }
      ],
      errors: [{ messageId: 'eagerModuleLevelUse' }]
    },
    // A custom allowlist replaces the default one.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Widget } from '@lumino/widgets';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Widget()
        };
      `,
      options: [
        {
          allowedPackages: ['@jupyterlab/*'],
          ignoreImports: [],
          reportModuleLevelUsage: false
        }
      ],
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A type-only re-export is erased, so the import can still be deferred.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { NotebookDiff } from './diff';
        export type { INotebookDiff } from './diff';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new NotebookDiff()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A helper called only from another function stays deferred.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { buildTable } from './table';
        function makeTable() {
          return buildTable();
        }
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => makeTable()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // One source imported twice with only deferred uses is reported once, with
    // the bindings of both declarations merged into the snippet.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { CpuView } from './cpuView';
        import { DEFAULT_CPU_LABEL } from './cpuView';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => CpuView.create(DEFAULT_CPU_LABEL)
        };
      `,
      errors: [
        {
          messageId: 'preferLazyImport',
          data: {
            source: './cpuView',
            snippet:
              "const { CpuView, DEFAULT_CPU_LABEL } = await import('./cpuView');"
          }
        }
      ]
    },
    // A module with enough code in it is reported.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyTable } from './lazy-large';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new HeavyTable({ rows: 2, columns: 2 })
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A small module counts the code of what it imports, so this one is over
    // the threshold even though its own file is tiny.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { createTable } from './lazy-barrel';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => createTable()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // Setting the threshold to zero reports every module regardless of size.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { CommandIDs } from './lazy-tiny';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => CommandIDs.open
        };
      `,
      options: [
        {
          allowedPackages: DEFAULT_ALLOWED_PACKAGES,
          ignoreImports: [],
          minimumSize: 0,
          reportModuleLevelUsage: false
        }
      ],
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // An SVG imported from JavaScript is inlined into the bundle as text, so a
    // large one belongs in a deferred chunk like any other module.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import diagram from './lazy-diagram.svg';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => diagram
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A raw stylesheet is inlined as text rather than applied as a style.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import theme from './lazy-theme.raw.css';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => theme
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A module-level `typeof` does not make the import eager.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyWidget } from 'heavy-pkg';
        type Widget = typeof HeavyWidget;
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new HeavyWidget()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // `requires` on an object which is not a plugin does not pin the import.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyThing } from 'heavy-pkg';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => {
            registry.add({ requires: [HeavyThing] });
          }
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A namespace beside other bindings has no single-line deferred form.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import theme, * as helpers from 'heavy-pkg';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => [theme, helpers]
        };
      `,
      errors: [
        {
          messageId: 'preferLazyImport',
          data: { source: 'heavy-pkg', snippet: "await import('heavy-pkg')" }
        }
      ]
    },
    // A user-supplied `!` entry denies a package the same list allows.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Grid } from '@myorg/grid';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Grid()
        };
      `,
      options: [
        {
          allowedPackages: ['@jupyterlab/*', '@myorg/*', '!@myorg/grid'],
          ignoreImports: [],
          minimumSize: 4096,
          reportModuleLevelUsage: false
        }
      ],
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A partial options object keeps the other defaults, so this one is still
    // measured and reported.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { HeavyTable } from './lazy-large';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new HeavyTable({ rows: 2, columns: 2 })
        };
      `,
      options: [{ reportModuleLevelUsage: false }],
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A shorthand `activate` naming a function declared elsewhere is callable.
    {
      filename: fixtureFilename,
      code: `
        import { HeavyTable } from './lazy-large';
        function activate() {
          return new HeavyTable({ rows: 1, columns: 1 });
        }
        export default { id: 'test:plugin', autoStart: true, activate };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // Shared but bundled here, so this extension still ships it.
    {
      filename: sharedPkgFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Bundled } from '@myorg/bundled-here';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Bundled()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // Shared with no `bundled` key defaults to being bundled here.
    {
      filename: sharedPkgFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Defaulted } from '@myorg/shared-default';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Defaulted()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // `false` removes the package from the shared scope altogether.
    {
      filename: sharedPkgFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Excluded } from '@myorg/not-shared';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Excluded()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // A package which is not in the shared runtime is bundled into the
    // extension, so it is reported without being measured.
    {
      filename: fixtureFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { parse } from 'heavy-parser';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => parse('')
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    },
    // Subpath imports resolve to their owning package for allowlist checks.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { render } from 'heavy-lib/lib/render';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => render()
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    }
  ]
});

ruleTester.run(
  'prefer-lazy-imports (interaction callbacks)',
  preferLazyImports,
  {
    valid: [
      // Off by default: a module without a plugin is not checked.
      {
        code: `
        import { saveAs } from 'file-saver';
        export function setup(button: HTMLElement) {
          button.addEventListener('click', () => saveAs(new Blob([])));
        }
      `
      },
      // An ordinary function proves nothing about when it runs.
      {
        code: `
        import { parse } from 'heavy-parser';
        export class Renderer {
          render(source: string) {
            return parse(source);
          }
        }
      `,
        options: [{ reportInteractionCallbacks: true }]
      },
      // One use outside a handler keeps the import where it is.
      {
        code: `
        import { saveAs } from 'file-saver';
        export function setup(button: HTMLElement) {
          button.addEventListener('click', () => saveAs(new Blob([])));
        }
        export function exportNow() {
          saveAs(new Blob([]));
        }
      `,
        options: [{ reportInteractionCallbacks: true }]
      },
      // A command label renders whenever the command is shown, which can be at
      // startup, so only `execute` counts as a handler.
      {
        code: `
        import { formatLabel } from 'heavy-pkg';
        export function addCommands(commands: any) {
          commands.addCommand('test:open', {
            label: () => formatLabel(),
            execute: () => undefined
          });
        }
      `,
        options: [{ reportInteractionCallbacks: true }]
      },
      // `load` fires while the page starts, so it is not an interaction event.
      {
        code: `
        import { init } from 'heavy-pkg';
        export function setup(img: HTMLElement) {
          img.addEventListener('load', () => init());
        }
      `,
        options: [{ reportInteractionCallbacks: true }]
      },
      // Packages in the shared runtime stay exempt.
      {
        code: `
        import { Widget } from '@lumino/widgets';
        export function setup(button: HTMLElement) {
          button.addEventListener('click', () => new Widget());
        }
      `,
        options: [{ reportInteractionCallbacks: true }]
      },
      // The size threshold applies here as well.
      {
        filename: fixtureFilename,
        code: `
        import { CommandIDs } from './lazy-tiny';
        export function addCommands(commands: any) {
          commands.addCommand('test:open', {
            execute: () => CommandIDs.open
          });
        }
      `,
        options: [{ reportInteractionCallbacks: true }]
      },
      // A value re-export keeps the source in the bundle here too.
      {
        code: `
        import { NotebookDiff } from './diff';
        export { NotebookDiff } from './diff';
        export function addCommands(commands: any) {
          commands.addCommand('test:diff', {
            execute: () => new NotebookDiff()
          });
        }
      `,
        options: [{ reportInteractionCallbacks: true }]
      },
      // A plugin module keeps its usual trigger: module level use stays silent.
      {
        code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { compute } from 'some-lib';
        const value = compute();
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => value
        };
      `,
        options: [{ reportInteractionCallbacks: true }]
      }
    ],
    invalid: [
      // A listener for an interaction event cannot run before the user acts.
      {
        code: `
        import { saveAs } from 'file-saver';
        export function setup(button: HTMLElement) {
          button.addEventListener('click', () => saveAs(new Blob([])));
        }
      `,
        options: [{ reportInteractionCallbacks: true }],
        errors: [
          {
            messageId: 'preferLazyImportInteraction',
            data: {
              source: 'file-saver',
              snippet: "const { saveAs } = await import('file-saver');"
            }
          }
        ]
      },
      // A command body only runs when the command is invoked.
      {
        code: `
        import { ProcessingDialog } from 'heavy-dialogs';
        export function addCommands(commands: any) {
          commands.addCommand('test:process', {
            execute: async () => new ProcessingDialog()
          });
        }
      `,
        options: [{ reportInteractionCallbacks: true }],
        errors: [{ messageId: 'preferLazyImportInteraction' }]
      },
      // A closure nested inside a handler waits for the user as well.
      {
        code: `
        import { parse } from 'heavy-parser';
        export function addCommands(commands: any) {
          commands.addCommand('test:parse', {
            execute: async () => {
              const run = () => parse('');
              return run();
            }
          });
        }
      `,
        options: [{ reportInteractionCallbacks: true }],
        errors: [{ messageId: 'preferLazyImportInteraction' }]
      },
      // Method shorthand for `execute` counts too.
      {
        code: `
        import { parse } from 'heavy-parser';
        export function addCommands(commands: any) {
          commands.addCommand('test:parse', {
            execute() {
              return parse('');
            }
          });
        }
      `,
        options: [{ reportInteractionCallbacks: true }],
        errors: [{ messageId: 'preferLazyImportInteraction' }]
      },
      // A DOM `on*` assignment is a handler position as well.
      {
        code: `
        import { saveAs } from 'file-saver';
        export function setup(button: HTMLButtonElement) {
          button.onclick = () => saveAs(new Blob([]));
        }
      `,
        options: [{ reportInteractionCallbacks: true }],
        errors: [{ messageId: 'preferLazyImportInteraction' }]
      },
      // In a plugin module the usual trigger takes precedence, so a click-only
      // import is reported with the plugin message.
      {
        code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { saveAs } from 'file-saver';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => {
            const button = document.createElement('button');
            button.addEventListener('click', () => saveAs(new Blob([])));
          }
        };
      `,
        options: [{ reportInteractionCallbacks: true }],
        errors: [{ messageId: 'preferLazyImport' }]
      }
    ]
  }
);

espreeTester.run(
  'prefer-lazy-imports (interaction callbacks, javascript)',
  preferLazyImports,
  {
    valid: [],
    invalid: [
      {
        code: `
          import { saveAs } from 'file-saver';
          export function setup(button) {
            button.addEventListener('click', () => saveAs(new Blob([])));
          }
        `,
        options: [{ reportInteractionCallbacks: true }],
        errors: [{ messageId: 'preferLazyImportInteraction' }]
      }
    ]
  }
);

tsxTester.run(
  'prefer-lazy-imports (interaction callbacks, tsx)',
  preferLazyImports,
  {
    valid: [
      // A prop which is not an interaction handler proves nothing.
      {
        code: `
          import * as React from 'react';
          import { renderCell } from 'heavy-grid';
          export function Grid() {
            return <div render={() => renderCell()} />;
          }
        `,
        options: [{ reportInteractionCallbacks: true }]
      }
    ],
    invalid: [
      // A JSX interaction handler prop waits for the user.
      {
        code: `
          import * as React from 'react';
          import { exportChart } from 'heavy-charts';
          export function ExportButton() {
            return <button onClick={() => exportChart()} />;
          }
        `,
        options: [{ reportInteractionCallbacks: true }],
        errors: [{ messageId: 'preferLazyImportInteraction' }]
      }
    ]
  }
);

tsxTester.run('prefer-lazy-imports (tsx)', preferLazyImports, {
  valid: [
    // React is loaded eagerly by the application.
    {
      code: `
        import * as React from 'react';
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { ReactWidget } from '@jupyterlab/ui-components';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => ReactWidget.create(<div />)
        };
      `
    }
  ],
  invalid: [
    // A JSX reference inside a function body is a deferred value reference.
    {
      code: `
        import * as React from 'react';
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Chart } from 'heavy-charts';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => {
            const render = () => <Chart />;
            return render;
          }
        };
      `,
      errors: [{ messageId: 'preferLazyImport' }]
    }
  ]
});

ruleTester.run('prefer-lazy-imports (deferred packages)', preferLazyImports, {
  valid: [
    // A type-only import is erased, whichever module it sits in.
    {
      code: `
        import type { DataGrid } from '@lumino/datagrid';
        export class GridHolder {
          grid: DataGrid | null = null;
        }
      `
    },
    // A type-only re-export is erased.
    {
      code: `export type { DataGrid } from '@lumino/datagrid';`
    },
    // Already deferred: this is the form the list asks for.
    {
      code: `
        export class GridWidget {
          async initialize() {
            const { DataGrid } = await import('@lumino/datagrid');
            return new DataGrid();
          }
        }
      `
    },
    // A package outside the list keeps the usual trigger, so a module without
    // a plugin in it is not checked.
    {
      code: `
        import { parse } from 'heavy-parser';
        export class Renderer {
          render(source: string) {
            return parse(source);
          }
        }
      `
    },
    // A stylesheet from a listed package is applied when imported, so it is
    // handled like every other asset.
    {
      code: `
        import 'react-toastify/dist/ReactToastify.css';
        export const ready = true;
      `
    },
    // An empty list switches the check off.
    {
      code: `
        import { DataGrid } from '@lumino/datagrid';
        export function createGrid() {
          return new DataGrid();
        }
      `,
      options: [{ deferredPackages: [] }]
    },
    // The list replaces the default one.
    {
      code: `
        import { DataGrid } from '@lumino/datagrid';
        export function createGrid() {
          return new DataGrid();
        }
      `,
      options: [{ deferredPackages: ['mermaid'] }]
    },
    // `ignoreImports` still skips a listed package.
    {
      code: `
        import { DataGrid } from '@lumino/datagrid';
        export function createGrid() {
          return new DataGrid();
        }
      `,
      options: [{ ignoreImports: ['@lumino/datagrid'] }]
    },
    // A `!` entry exempts one subpath of a listed package.
    {
      code: `
        import { python } from '@codemirror/legacy-modes/mode/python';
        export function mode() {
          return python;
        }
      `,
      options: [
        {
          deferredPackages: [
            '@codemirror/legacy-modes',
            '!@codemirror/legacy-modes/mode/python'
          ]
        }
      ]
    }
  ],
  invalid: [
    // The core case: a module which no plugin trigger reaches.
    {
      code: `
        import { DataGrid } from '@lumino/datagrid';
        export class GridWidget {
          create() {
            return new DataGrid();
          }
        }
      `,
      errors: [
        {
          messageId: 'deferredPackageImport',
          data: {
            source: '@lumino/datagrid',
            snippet: "const { DataGrid } = await import('@lumino/datagrid');"
          }
        }
      ]
    },
    // A base class is needed while the module is evaluated.
    {
      code: `
        import { DataModel } from '@lumino/datagrid';
        export class CSVModel extends DataModel {}
      `,
      errors: [
        {
          messageId: 'deferredPackageEagerUse',
          data: { source: '@lumino/datagrid' }
        }
      ]
    },
    // A side-effect import loads the package as well.
    {
      code: `
        import 'mermaid';
        export const ready = true;
      `,
      errors: [
        {
          messageId: 'deferredPackageImport',
          data: { source: 'mermaid', snippet: "await import('mermaid');" }
        }
      ]
    },
    // A value re-export keeps the package in the startup bundle.
    {
      code: `export { DataGrid } from '@lumino/datagrid';`,
      errors: [
        {
          messageId: 'deferredPackageReExport',
          data: { source: '@lumino/datagrid' }
        }
      ]
    },
    {
      code: `export * from 'mermaid';`,
      errors: [{ messageId: 'deferredPackageReExport' }]
    },
    // A value import with no runtime use is erased only without
    // `verbatimModuleSyntax`, which JupyterLab enables, so it is reported with
    // advice to write `import type`. Used only as a type:
    {
      code: `
        import { DataModel } from '@lumino/datagrid';
        export interface IInspectable {
          model: DataModel;
        }
      `,
      errors: [
        {
          messageId: 'deferredPackageNotTypeOnly',
          data: { source: '@lumino/datagrid' }
        }
      ]
    },
    // Used only inside `typeof`:
    {
      code: `
        import { DataGrid } from '@lumino/datagrid';
        export type GridClass = typeof DataGrid;
      `,
      errors: [{ messageId: 'deferredPackageNotTypeOnly' }]
    },
    // Not used at all:
    {
      code: `
        import { DataGrid } from '@lumino/datagrid';
        export const ready = true;
      `,
      errors: [{ messageId: 'deferredPackageNotTypeOnly' }]
    },
    // An inline `type` specifier leaves `import {} from '...'` behind under
    // `verbatimModuleSyntax`, which still loads the package.
    {
      code: `
        import { type DataGrid } from '@lumino/datagrid';
        export const ready = true;
      `,
      errors: [{ messageId: 'deferredPackageNotTypeOnly' }]
    },
    // The same holds for a re-export with inline `type` specifiers.
    {
      code: `export { type DataGrid } from '@lumino/datagrid';`,
      errors: [{ messageId: 'deferredPackageReExport' }]
    },
    // A subpath import matches through its owning package.
    {
      code: `
        import { python } from '@codemirror/legacy-modes/mode/python';
        export function mode() {
          return python;
        }
      `,
      errors: [{ messageId: 'deferredPackageImport' }]
    },
    // A wildcard entry covers every language package.
    {
      code: `
        import { python } from '@codemirror/lang-python';
        export function extensions() {
          return [python()];
        }
      `,
      errors: [{ messageId: 'deferredPackageImport' }]
    },
    // One source imported twice: the declarations with a runtime use share one
    // report and one snippet, and the one used only as a type is reported on
    // its own line, since deleting the first would leave it behind.
    {
      code: `
        import { DataGrid } from '@lumino/datagrid';
        import { DataModel } from '@lumino/datagrid';
        export function createGrid(model: DataModel) {
          return new DataGrid({ dataModel: model });
        }
      `,
      errors: [
        {
          messageId: 'deferredPackageImport',
          line: 2,
          data: {
            source: '@lumino/datagrid',
            snippet: "const { DataGrid } = await import('@lumino/datagrid');"
          }
        },
        { messageId: 'deferredPackageNotTypeOnly', line: 3 }
      ]
    },
    // An unused declaration next to a used one is reported on its own as
    // well, whichever order they come in.
    {
      code: `
        import { Unused } from 'mermaid';
        import { Diagram } from 'mermaid';
        export function render() {
          return new Diagram();
        }
      `,
      errors: [
        { messageId: 'deferredPackageNotTypeOnly', line: 2 },
        {
          messageId: 'deferredPackageImport',
          line: 3,
          data: {
            source: 'mermaid',
            snippet: "const { Diagram } = await import('mermaid');"
          }
        }
      ]
    },
    // The same next to a side-effect import.
    {
      code: `
        import 'mermaid';
        import { Unused } from 'mermaid';
        export const ready = true;
      `,
      errors: [
        {
          messageId: 'deferredPackageImport',
          line: 2,
          data: { source: 'mermaid', snippet: "await import('mermaid');" }
        },
        { messageId: 'deferredPackageNotTypeOnly', line: 3 }
      ]
    },
    // In a plugin module the list takes over from the usage check, so the
    // import is reported once, with the deferred message.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { DataGrid } from '@lumino/datagrid';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new DataGrid()
        };
      `,
      errors: [{ messageId: 'deferredPackageImport' }]
    },
    // Module level use in a plugin module is reported without the strict
    // option, and once with it.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { DataGrid } from '@lumino/datagrid';
        const grid = new DataGrid();
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => grid
        };
      `,
      errors: [{ messageId: 'deferredPackageEagerUse' }]
    },
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { DataGrid } from '@lumino/datagrid';
        const grid = new DataGrid();
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => grid
        };
      `,
      options: [{ reportModuleLevelUsage: true }],
      errors: [{ messageId: 'deferredPackageEagerUse' }]
    },
    // A token from a listed package is read when the plugin is registered.
    {
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { IGrid } from 'heavy-grid';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          requires: [IGrid],
          activate: (app, grid) => grid
        };
      `,
      options: [{ deferredPackages: ['heavy-grid'] }],
      errors: [{ messageId: 'deferredPackageEagerUse' }]
    },
    // The list wins over `allowedPackages`.
    {
      code: `
        import { DataGrid } from '@lumino/datagrid';
        export function createGrid() {
          return new DataGrid();
        }
      `,
      options: [{ allowedPackages: ['@lumino/*'] }],
      errors: [{ messageId: 'deferredPackageImport' }]
    },
    // The list wins over the manifest, which marks this package as provided
    // by the application.
    {
      filename: sharedPkgFilename,
      code: `
        import { JupyterFrontEndPlugin } from '@jupyterlab/application';
        import { Shared } from '@myorg/host-provided';
        const plugin: JupyterFrontEndPlugin<void> = {
          id: 'test:plugin',
          autoStart: true,
          activate: () => new Shared()
        };
      `,
      options: [{ deferredPackages: ['@myorg/host-provided'] }],
      errors: [{ messageId: 'deferredPackageImport' }]
    }
  ]
});

espreeTester.run(
  'prefer-lazy-imports (deferred packages, javascript)',
  preferLazyImports,
  {
    valid: [],
    invalid: [
      {
        code: `
          import { DataGrid } from '@lumino/datagrid';
          export function createGrid() {
            return new DataGrid();
          }
        `,
        errors: [{ messageId: 'deferredPackageImport' }]
      },
      // Nothing is erased in JavaScript, so an unused import loads the package.
      {
        code: `
          import { DataGrid } from '@lumino/datagrid';
          export const ready = true;
        `,
        errors: [{ messageId: 'deferredPackageNotTypeOnly' }]
      }
    ]
  }
);
