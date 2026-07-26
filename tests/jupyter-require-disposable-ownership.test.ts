/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import * as path from 'path';
import requireDisposableOwnership from '../src/rules/require-disposable-ownership';

const typeAwareFilename = 'tests/type-aware-fixture.ts';

const nonTypeAwareTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      tsconfigRootDir: path.resolve(__dirname, '..')
    }
  }
});

const ruleTester = new RuleTester({
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

nonTypeAwareTester.run(
  'require-disposable-ownership (non-type-aware)',
  requireDisposableOwnership,
  {
    valid: [
      {
        code: `
          declare function cleanup(): void;
          declare const _disposables: { add(disposable: DisposableDelegate): void };
          class DisposableDelegate {
            constructor(callback: () => void) {}
          }

          _disposables.add(new DisposableDelegate(() => {
            cleanup();
          }));
        `
      },
      {
        code: `
          declare function cleanup(): void;
          declare const _disposables: { add(disposable: ObservableDisposableDelegate): void };
          class ObservableDisposableDelegate {
            constructor(callback: () => void) {}
          }

          _disposables.add(new ObservableDisposableDelegate(() => {
            cleanup();
          }));
        `
      }
    ],
    invalid: [
      {
        code: `
          declare function cleanup(): void;
          class DisposableDelegate {
            constructor(callback: () => void) {}
          }

          new DisposableDelegate(() => {
            cleanup();
          });
        `,
        errors: [{ messageId: 'unmanagedDisposable' }]
      },
      {
        code: `
          declare function cleanup(): void;
          class ObservableDisposableDelegate {
            constructor(callback: () => void) {}
          }

          new ObservableDisposableDelegate(() => {
            cleanup();
          });
        `,
        errors: [{ messageId: 'unmanagedDisposable' }]
      },
      {
        code: `
          class ObservableDisposableSet {}

          new ObservableDisposableSet();
        `,
        errors: [{ messageId: 'unmanagedDisposable' }]
      }
    ]
  }
);

ruleTester.run('require-disposable-ownership', requireDisposableOwnership, {
  valid: [
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class DisposableSet {
          add(disposable: DisposableDelegate): void {}
        }
        declare const disposables: DisposableSet;

        disposables.add(new DisposableDelegate(() => {
          cleanup();
        }));
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const shell: {
          add(disposable: DisposableDelegate): void;
        };

        shell.add(new DisposableDelegate(() => {
          cleanup();
        }));
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class DisposableSet {
          dispose(): void {}
        }
        class AttachedProperty<T, U> {
          set(owner: T, value: U): void {}
        }
        declare const widget: object;
        declare const disposablesProperty: AttachedProperty<object, DisposableSet>;

        const disposables = new DisposableSet();
        disposablesProperty.set(widget, disposables);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class DisposableSet {
          dispose(): void {}
        }
        declare const widget: object;
        declare const Private: {
          disposablesProperty: {
            set(owner: object, value: DisposableSet): void;
          };
        };

        Private.disposablesProperty.set(widget, new DisposableSet());
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        function createDisposable(): DisposableDelegate {
          return new DisposableDelegate(() => {
            cleanup();
          });
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class MainAreaWidget {
          readonly isDisposed = false;
          constructor(options: { content: Widget }) {}
          dispose(): void {}
        }

        function createMainAreaWidget(): MainAreaWidget {
          const content = new Widget();
          return new MainAreaWidget({ content });
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare function showDialog(options: { body: Widget }): void;

        showDialog({ body: new Widget() });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare function showDialog(options: { body: Widget }): void;

        const body = new Widget();
        showDialog({ body });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class Dialog {
          readonly isDisposed = false;
          constructor(options: { body: Widget }) {}
          dispose(): void {}
          launch(): Promise<void> {
            return Promise.resolve();
          }
        }

        async function prompt(): Promise<void> {
          const dialog = new Dialog({ body: new Widget() });
          await dialog.launch();
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class StatusItem {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare const statusBar: {
          registerStatusItem(id: string, options: { item: StatusItem }): void;
        };

        const item = new StatusItem();
        statusBar.registerStatusItem('status', { item });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class StatusItem {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare const statusBar: {
          registerStatusItem(id: string, options: { item: StatusItem }): void;
        } | null;

        const item = statusBar ? new StatusItem() : null;
        if (statusBar && item) {
          statusBar.registerStatusItem('status', { item });
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare const layout: {
          insertWidget(index: number, widget: Widget): void;
        };

        const widget = new Widget();
        layout.insertWidget(0, widget);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Menu {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class MenuBar {
          addMenu(menu: Menu): void {}
        }

        const menu = new Menu();
        const menubar = new MenuBar();
        menubar.addMenu(menu);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Menu {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare const menuBar: {
          addGroup(items: Array<{ type: 'submenu'; submenu: Menu }>, rank: number): void;
        };

        const menu = new Menu();
        menuBar.addGroup([{ type: 'submenu', submenu: menu }], 40);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        import type { JupyterFrontEndPlugin } from './fixtures/types';

        class WidgetTracker<T> {
          readonly isDisposed = false;
          constructor(options: { namespace: string }) {}
          dispose(): void {}
        }

        export const plugin: JupyterFrontEndPlugin<void> = {
          id: 'example:tracker',
          activate: () => {
            const tracker = new WidgetTracker<object>({
              namespace: 'example'
            });
            console.log(tracker);
          }
        };
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class WidgetTracker<T> {
          readonly isDisposed = false;
          constructor(options: { namespace: string }) {}
          dispose(): void {}
        }
        declare const token: unknown;

        function createPlugins(): unknown[] {
          const plugins: unknown[] = [];
          const tracker = new WidgetTracker<object>({
            namespace: 'example'
          });

          plugins.push({
            id: 'example:tracker',
            provides: token,
            autoStart: true,
            activate: () => {
              return tracker;
            }
          });

          return plugins;
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare const condition: boolean;
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare const shell: {
          add(widget: Widget): void;
        };

        if (condition) {
          const widget = new Widget();
          shell.add(widget);
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }

        class Owner {
          private _widgets = new Map<string, Widget>();

          addWidget(): void {
            const widget = new Widget();
            this._widgets.set('widget', widget);
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }

        function createToolbarItems(): Array<{ name: string; widget: Widget }> {
          return [
            {
              name: 'refresh',
              widget: new Widget()
            }
          ];
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }

        class Owner {
          private _state: { widget: Widget } | null = null;

          initialize(): void {
            this._state = {
              widget: new Widget()
            };
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }

        class Owner {
          private _items: Array<{ widget: Widget }> = [];

          addWidget(): void {
            const widget = new Widget();
            this._items.push({ widget });
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class WidgetFactory {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare const docRegistry: {
          addWidgetFactory(factory: WidgetFactory): void;
        };

        const factory = new WidgetFactory();
        const textFactory = new WidgetFactory();
        [factory, textFactory].forEach(factory => {
          docRegistry.addWidgetFactory(factory);
        });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare const id: string;
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }

        function createWidget(): Widget {
          let widget: Widget;
          switch (id) {
            case 'left':
              widget = new Widget();
              break;
            case 'right':
              widget = new Widget();
              break;
            default:
              widget = new Widget();
          }

          return widget;
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
          initializeState(): this {
            return this;
          }
        }

        function createWidget(): Widget {
          return new Widget().initializeState();
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class Model {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class CodeEditorWrapper {
          readonly isDisposed = false;
          constructor(options: { model: Model }) {}
          dispose(): void {}
        }

        function createEditor(): CodeEditorWrapper {
          const model = new Model();
          return new CodeEditorWrapper({ model });
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Model {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class Licenses {
          readonly isDisposed = false;
          constructor(options: { model: Model }) {}
          dispose(): void {}
        }

        function createLicenses(): Licenses {
          const model = new Model();
          return new Licenses({ model });
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class Dialog<T> {
          readonly isDisposed = false;
          constructor(options: { body: Widget }) {}
          dispose(): void {}
          launch(): Promise<T> {
            return Promise.resolve(undefined as T);
          }
        }
        class PromptDialog extends Dialog<string> {}

        function prompt(): Promise<string> {
          const dialog = new PromptDialog({ body: new Widget() });
          return dialog.launch();
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare function showPopup(options: { body: Widget }): Widget;

        class Owner {
          private _popup: Widget | null = null;

          open(): void {
            const body = new Widget();
            this._popup = showPopup({ body });
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class DocumentWidget<T extends Widget> {
          readonly isDisposed = false;
          constructor(options: { content: T }) {}
          dispose(): void {}
        }
        class MarkdownDocument extends DocumentWidget<Widget> {}

        function createDocument(): MarkdownDocument {
          const content = new Widget();
          return new MarkdownDocument({ content });
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class NotebookHistory {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class Notebook {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class NotebookPanel {
          readonly isDisposed = false;
          constructor(options: { content: Notebook }) {}
          dispose(): void {}
        }
        declare const contentFactory: {
          createNotebook(options: { kernelHistory: NotebookHistory }): Notebook;
        };

        function createPanel(): NotebookPanel {
          const kernelHistory = new NotebookHistory();
          const nbOptions = { kernelHistory };
          const content = contentFactory.createNotebook(nbOptions);
          return new NotebookPanel({ content });
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class DisposableSet {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare function defer(callback: () => void): void;

        const set = new DisposableSet();
        defer(() => {
          set.dispose();
        });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        function activate(): void {
          let current: DisposableDelegate | null = null;

          const createCurrent = () => {
            current = new DisposableDelegate(() => {
              cleanup();
            });
          };

          createCurrent();
          console.log(current);
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class LabShell {
          readonly isDisposed = false;
          dispose(): void {}
        }
        interface IOptions {
          shell: LabShell;
        }

        class Application {
          constructor(options: IOptions = { shell: new LabShell() }) {}
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        class Owner {
          private _disposable: DisposableDelegate | null = null;

          initialize(): void {
            this._disposable =
              this._disposable ??
              new DisposableDelegate(() => {
                cleanup();
              });
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class Base {
          constructor(options: { disposable: DisposableDelegate }) {}
        }
        class Owner extends Base {
          constructor() {
            super({
              disposable: new DisposableDelegate(() => {
                cleanup();
              })
            });
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        const createDisposable = () => new DisposableDelegate(() => {
          cleanup();
        });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        class Owner {
          private _disposable: DisposableDelegate | null = null;

          initialize(): void {
            this._disposable = new DisposableDelegate(() => {
              cleanup();
            });
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class DisposableSet {
          dispose(): void {}
        }

        class Owner {
          private _disposables = new DisposableSet();
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class DisposableSet {
          static from(items: Iterable<DisposableDelegate>): DisposableSet {
            return new DisposableSet();
          }
          dispose(): void {}
        }

        DisposableSet.from([
          new DisposableDelegate(() => {
            cleanup();
          })
        ]).dispose();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        new DisposableDelegate(() => {
          cleanup();
        }).dispose();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const widget: {
          readonly disposed: {
            connect(callback: () => void): void;
          };
        };

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        widget.disposed.connect(() => {
          disposable.dispose();
        });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class DisposableSet {
          add(disposable: object): void {}
          dispose(): void {}
        }
        declare const shortcuts: object[];
        let disposables: DisposableSet | null = null;

        function loadShortcuts(): void {
          disposables = shortcuts.reduce((acc): DisposableSet => {
            acc.add({});
            return acc;
          }, new DisposableSet());
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        class Panel extends Widget {}

        class OutputArea {
          addWarning(): Panel {
            const warning = new Widget();
            return this._wrappedOutput(warning);
          }

          private _wrappedOutput(output: Widget): Panel {
            return new Panel();
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        disposable.dispose();
      `
    },
    {
      filename: typeAwareFilename,
      options: [{ ownershipFunctionNames: ['ownDisposable'] }],
      code: `
        declare function cleanup(): void;
        declare function ownDisposable(disposable: DisposableDelegate): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        ownDisposable(disposable);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        class CustomDisposable implements IDisposable {
          readonly isDisposed = false;
          dispose(): void {}
        }

        function createDisposable(): IDisposable {
          return new CustomDisposable();
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `new Date();`
    }
  ],

  invalid: [
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        new DisposableDelegate(() => {
          cleanup();
        });
      `,
      errors: [{ messageId: 'unmanagedDisposable' }]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class Widget {
          constructor(options: { disposable: DisposableDelegate }) {}
        }

        new Widget({
          disposable: new DisposableDelegate(() => {
            cleanup();
          })
        });
      `,
      errors: [{ messageId: 'unmanagedDisposable' }]
    },
    {
      filename: typeAwareFilename,
      code: `
        class DisposableSet {
          dispose(): void {}
        }
        declare const widget: object;
        declare const values: {
          set(owner: object, value: DisposableSet): void;
        };

        const disposables = new DisposableSet();
        values.set(widget, disposables);
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposables' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        class DisposableSet {
          dispose(): void {}
        }

        let disposables = new DisposableSet();
        disposables.dispose();
        disposables = new DisposableSet();
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposables' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        console.log(disposable);
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposable' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        let disposable: DisposableDelegate;
        disposable = new DisposableDelegate(() => {
          cleanup();
        });
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposable' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        let disposable = new DisposableDelegate(() => {
          cleanup();
        });
        disposable = new DisposableDelegate(() => {
          cleanup();
        });
        disposable.dispose();
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposable' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        function createLeak(): void {
          const disposable = new DisposableDelegate(() => {
            cleanup();
          });
        }

        function disposeOther(disposable: DisposableDelegate): void {
          disposable.dispose();
        }
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposable' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        declare const condition: boolean;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        if (condition) {
          disposable.dispose();
        }
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposable' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare const condition: boolean;
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare const shell: {
          add(widget: Widget): void;
        };

        const widget = new Widget();
        if (condition) {
          shell.add(widget);
        }
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'widget' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare const condition: boolean;
        class WidgetFactory {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare const docRegistry: {
          addWidgetFactory(factory: WidgetFactory): void;
        };

        const factory = new WidgetFactory();
        [factory].forEach(factory => {
          if (condition) {
            docRegistry.addWidgetFactory(factory);
          }
        });
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'factory' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare const condition: boolean;
        class Widget {
          readonly isDisposed = false;
          dispose(): void {}
        }
        declare function showDialog(options: { body: Widget }): void;

        const body = new Widget();
        if (condition) {
          showDialog({ body });
        }
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'body' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        declare function defer(callback: () => void): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        defer(() => {
          disposable.dispose();
        });
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposable' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        declare const condition: boolean;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const widget: {
          readonly disposed: {
            connect(callback: () => void): void;
          };
        };

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        widget.disposed.connect(() => {
          if (condition) {
            disposable.dispose();
          }
        });
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposable' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        class DisposableSet {
          dispose(): void {}
        }
        declare const shortcuts: object[];

        shortcuts.reduce((): DisposableSet => {
          return new DisposableSet();
        }, new DisposableSet());
      `,
      errors: [{ messageId: 'unmanagedDisposable' }]
    },
    {
      filename: typeAwareFilename,
      options: [{ ownershipFunctionNames: [] }],
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const items: { add(disposable: DisposableDelegate): void };

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        items.add(disposable);
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'disposable' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        class CustomDisposable implements IDisposable {
          readonly isDisposed = false;
          dispose(): void {}
        }

        new CustomDisposable();
      `,
      errors: [{ messageId: 'unmanagedDisposable' }]
    }
  ]
});
