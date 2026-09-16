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
      // A tuple rest parameter after a leading parameter: the first rest
      // argument maps to tuple element 0, not to element 1.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          readonly isDisposed = false;
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class Plain {
          value = 1;
        }
        declare const sink: {
          (a: number, ...rest: [DisposableDelegate, Plain]): void;
        };

        export function go(): void {
          sink(1, new DisposableDelegate(() => undefined), new Plain());
        }
      `
    },
    {
      // A disposable created inline as a constructor argument: the constructor
      // declares the parameter as disposable, so it takes ownership.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          readonly isDisposed = false;
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class Owner {
          readonly isDisposed = false;
          constructor(disposable: DisposableDelegate) {}
          dispose(): void {}
        }

        export function make(): Owner {
          return new Owner(new DisposableDelegate(() => undefined));
        }
      `
    },
    {
      // The same through an array argument: the element binds to the element
      // type of the declared parameter.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          readonly isDisposed = false;
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class Owner {
          readonly isDisposed = false;
          constructor(items: DisposableDelegate[]) {}
          dispose(): void {}
        }

        export function make(): Owner {
          return new Owner([new DisposableDelegate(() => undefined)]);
        }
      `
    },
    {
      // Mirrors ServiceManagerMock (services/src/testutils.ts): disposables are
      // properties of an object literal held in a variable that is returned.
      filename: typeAwareFilename,
      code: `
        class Manager {
          dispose(): void {}
          readonly isDisposed: boolean = false;
        }

        export function makeServiceManager(): { contents: Manager } {
          const thisObject = {
            contents: new Manager(),
            sessions: new Manager()
          };
          return thisObject;
        }
      `
    },
    {
      // Mirrors ContentsManagerMock: the disposable is captured by callbacks
      // that are wrapped in jest.fn() and hung off the returned object.
      filename: typeAwareFilename,
      code: `
        class Manager {
          driveName(path: string): string {
            return path;
          }
          dispose(): void {}
          readonly isDisposed: boolean = false;
        }
        declare function wrap<T>(fn: T): T;

        export function makeContentsManager(): { get: (p: string) => string } {
          const dummy = new Manager();
          const thisObject = {
            get: wrap((p: string) => dummy.driveName(p))
          };
          return thisObject;
        }
      `
    },
    {
      // A spread carries the aggregate onwards.
      filename: typeAwareFilename,
      code: `
        class Manager {
          dispose(): void {}
          readonly isDisposed: boolean = false;
        }
        declare const disposables: { add(x: unknown): void };

        export function build(): void {
          const extra = { manager: new Manager() };
          disposables.add({ ...extra, name: 'x' });
        }
      `
    },
    {
      // Mirrors JupyterLab's createToolbarFactory (apputils/src/toolbar/factory.ts):
      // `items` is created once, passed to a helper, captured by the returned
      // factory closure and by handlers declared inside it, and never disposed.
      // The returned closure owns it.
      filename: typeAwareFilename,
      code: `
        declare class ObservableList<T> {
          constructor(options: { itemCmp: (a: T, b: T) => boolean });
          readonly changed: {
            connect(cb: () => void): void;
            disconnect(cb: () => void): void;
          };
          get(index: number): T;
          dispose(): void;
          readonly isDisposed: boolean;
        }
        declare function setToolbarItems(
          items: ObservableList<string>
        ): Promise<void>;
        declare const registry: {
          factoryAdded: {
            connect(cb: () => void): void;
            disconnect(cb: () => void): void;
          };
        };
        declare const widget: { disposed: { connect(cb: () => void): void } };

        export function createToolbarFactory(): () => void {
          const items = new ObservableList<string>({
            itemCmp: (a, b) => a === b
          });

          setToolbarItems(items).catch(() => undefined);

          return () => {
            const updateToolbar = () => {
              void Array.from([items.get(0)]);
            };
            const updateWidget = () => {
              void items.get(0);
            };
            registry.factoryAdded.connect(updateWidget);
            items.changed.connect(updateToolbar);
            widget.disposed.connect(() => {
              items.changed.disconnect(updateToolbar);
              registry.factoryAdded.disconnect(updateWidget);
            });
          };
        }
      `
    },
    {
      // The same ownership handoff written with an implicit arrow return.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
          use(): void {}
        }
        const makeFactory = () => {
          const items = new DisposableDelegate(() => undefined);
          return () => items.use();
        };
        void makeFactory;
      `
    },
    {
      // Ownership transfer at the top level of an escaping callback.
      filename: typeAwareFilename,
      code: `
        declare function defer(cb: () => void): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const disposables: { add(x: DisposableDelegate): void };

        function go(): void {
          const d = new DisposableDelegate(() => undefined);
          defer(() => {
            disposables.add(d);
          });
        }
      `
    },
    {
      // A callback stored on a field can still be run later.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class Owner {
          private _cleanup: (() => void) | null = null;
          init(): void {
            const d = new DisposableDelegate(() => undefined);
            this._cleanup = () => d.dispose();
          }
        }
      `
    },
    {
      // A custom ownership name is ADDED to the defaults, so the built-in
      // `add` keeps working alongside it.
      filename: typeAwareFilename,
      options: [{ ownershipFunctionNames: ['ownDisposable'] }],
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const items: { add(disposable: DisposableDelegate): void };

        const first = new DisposableDelegate(() => undefined);
        items.add(first);
      `
    },
    {
      // An empty options object must behave exactly like no options at all.
      // ESLint fills schema `default` values into the options object, so array
      // options must not declare one or "was it provided" becomes undetectable.
      filename: typeAwareFilename,
      options: [{}],
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const items: { add(disposable: DisposableDelegate): void };

        const first = new DisposableDelegate(() => undefined);
        items.add(first);
      `
    },
    {
      // Exported singleton: ownership belongs to the importers of the module.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        export const tracker = new DisposableDelegate(() => undefined);
      `
    },
    {
      // Exported by a later statement rather than at the declaration.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        const tracker = new DisposableDelegate(() => undefined);
        export { tracker };
      `
    },
    {
      // Exported by a later statement under a different name.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        const tracker = new DisposableDelegate(() => undefined);
        export { tracker as dialogTracker };
      `
    },
    {
      // Exported as the module default.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        const tracker = new DisposableDelegate(() => undefined);
        export default tracker;
      `
    },
    {
      // Exported singleton inside a namespace (Dialog.tracker,
      // Notification.manager).
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        export namespace Private {
          export const tracker = new DisposableDelegate(() => undefined);
        }
      `
    },
    {
      // Plugin activation split into a named function, referenced as
      // `activate: activateCsv`.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        function activateCsv(): void {
          const tracker = new DisposableDelegate(() => undefined);
          void tracker;
        }
        const plugin = {
          id: 'example:plugin',
          autoStart: true,
          activate: activateCsv
        };
        export default plugin;
      `
    },
    {
      // Plugin activation as `export function activate()`, the convention for
      // activation living in a `Private` namespace.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        export namespace Private {
          export function activate(): void {
            const palette = new DisposableDelegate(() => undefined);
            void palette;
          }
        }
      `
    },
    {
      // Unconditional disposal inside a callback: the
      // `requestAnimationFrame(() => splash.dispose())` idiom.
      filename: typeAwareFilename,
      code: `
        declare function defer(callback: () => void): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        function load(): void {
          const splash = new DisposableDelegate(() => undefined);
          defer(() => {
            splash.dispose();
          });
        }
      `
    },
    {
      // Disposal in a promise chain.
      filename: typeAwareFilename,
      code: `
        declare function work(): Promise<void>;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        function load(): void {
          const splash = new DisposableDelegate(() => undefined);
          void work()
            .then(() => {
              splash.dispose();
            })
            .catch(() => {
              splash.dispose();
            });
        }
      `
    },
    {
      // Captured by a returned closure that disposes it.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        function createFactory(): () => void {
          const items = new DisposableDelegate(() => undefined);
          return () => items.dispose();
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
    },
    {
      // A generic class whose `dispose` is the type parameter is disposable
      // only in the instantiations where that parameter is callable, so the
      // answer cannot be reused across instantiations.
      filename: typeAwareFilename,
      code: `
        class Box<T> {
          readonly isDisposed = false;
          dispose!: T;
        }

        export function keep(): void {
          new Box<number>();
        }
      `
    }
  ],

  invalid: [
    {
      // The instantiation that makes `dispose` callable is a disposable, and
      // the one on the line before it is not; answering both from whichever
      // was seen first would lose this report.
      filename: typeAwareFilename,
      code: `
        class Box<T> {
          readonly isDisposed = false;
          dispose!: T;
        }

        export function leak(): void {
          new Box<number>();
          new Box<() => void>();
        }
      `,
      errors: [{ messageId: 'unmanagedDisposable' }]
    },
    {
      // Owned option names are scoped to the parameter they came from: `payload`
      // is disposable on the first parameter only, so the second argument's
      // object must not be credited by it.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          readonly isDisposed = false;
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        class Plain {
          value = 1;
        }
        declare function two(
          first: { payload: DisposableDelegate },
          second: { payload: Plain }
        ): void;

        export function go(): void {
          const leaked = new DisposableDelegate(() => undefined);
          const secondBag = { payload: leaked as unknown as Plain };
          two({ payload: new DisposableDelegate(() => undefined) }, secondBag);
        }
      `,
      errors: [
        { messageId: 'unmanagedDisposableVariable', data: { name: 'leaked' } }
      ]
    },
    {
      // A closure that captures the disposable but is not returned hands off
      // nothing, so the disposable is still unowned.
      filename: typeAwareFilename,
      code: `
        declare function defer(cb: () => void): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
          use(): void {}
        }

        function go(): void {
          const items = new DisposableDelegate(() => undefined);
          defer(() => items.use());
        }
      `,
      errors: [
        { messageId: 'unmanagedDisposableVariable', data: { name: 'items' } }
      ]
    },
    {
      // A callback that is only declared, never invoked, registered or
      // returned, is not a cleanup path.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        function go(): void {
          const d = new DisposableDelegate(() => undefined);
          const cleanupLater = () => d.dispose();
        }
      `,
      errors: [
        { messageId: 'unmanagedDisposableVariable', data: { name: 'd' } }
      ]
    },
    {
      // Conditional ownership transfer inside a callback is not a transfer,
      // matching how same-scope conditional uses are treated.
      filename: typeAwareFilename,
      code: `
        declare function defer(cb: () => void): void;
        declare const condition: boolean;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const disposables: { add(x: DisposableDelegate): void };

        function go(): void {
          const d = new DisposableDelegate(() => undefined);
          defer(() => {
            if (condition) {
              disposables.add(d);
            }
          });
        }
      `,
      errors: [
        { messageId: 'unmanagedDisposableVariable', data: { name: 'd' } }
      ]
    },
    {
      // A reassigned export is not a module-lifetime singleton: the replaced
      // value can no longer be reached, let alone disposed.
      filename: typeAwareFilename,
      code: `
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        export let tracker = new DisposableDelegate(() => undefined);
        tracker = new DisposableDelegate(() => undefined);
      `,
      errors: [
        { messageId: 'unmanagedDisposableVariable', data: { name: 'tracker' } },
        { messageId: 'unmanagedDisposableVariable', data: { name: 'tracker' } }
      ]
    },
    {
      // A shadowing binding inside the callback must not silence the outer
      // disposable: the ownership check resolves identifiers, not names.
      filename: typeAwareFilename,
      code: `
        declare function defer(cb: () => void): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const disposables: { add(d: DisposableDelegate): void };

        function go(): void {
          const splash = new DisposableDelegate(() => undefined);
          defer(() => {
            {
              const splash = new DisposableDelegate(() => undefined);
              disposables.add(splash);
            }
            void splash;
          });
        }
      `,
      errors: [
        {
          messageId: 'unmanagedDisposableVariable',
          data: { name: 'splash' }
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
          constructor(options: { disposable: unknown }) {}
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
          set(owner: object, value: unknown): void;
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
      // Disposal inside a callback that is only *conditionally* reached still
      // counts as unmanaged. Unconditional disposal inside the callback is
      // accepted - see the matching valid case.
      filename: typeAwareFilename,
      code: `
        declare function cleanup(): void;
        declare const condition: boolean;
        declare function defer(callback: () => void): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }

        const disposable = new DisposableDelegate(() => {
          cleanup();
        });
        defer(() => {
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
      options: [{ extendDefaultOwnershipFunctionNames: false }],
      code: `
        declare function cleanup(): void;
        class DisposableDelegate {
          constructor(callback: () => void) {}
          dispose(): void {}
        }
        declare const items: { add(disposable: unknown): void };

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
