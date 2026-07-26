/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import * as path from 'path';
import requireDisposableTransfer from '../src/rules/require-disposable-transfer';

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
  'require-disposable-transfer (non-type-aware)',
  requireDisposableTransfer,
  {
    valid: [
      {
        code: `
          declare function createDisposable(): IDisposable;
          createDisposable();
        `
      },
      {
        code: `
          const disposables = DisposableSet.from([]);
          disposables.dispose();
        `
      },
      {
        code: `
          ObservableDisposableSet.from([]).dispose();
        `
      }
    ],
    invalid: [
      {
        code: `
          DisposableSet.from([]);
        `,
        errors: [
          {
            messageId: 'unhandledDisposable',
            data: { name: 'from' }
          }
        ]
      },
      {
        code: `
          ObservableDisposableSet.from([]);
        `,
        errors: [
          {
            messageId: 'unhandledDisposable',
            data: { name: 'from' }
          }
        ]
      }
    ]
  }
);

ruleTester.run('require-disposable-transfer', requireDisposableTransfer, {
  valid: [
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        class DisposableSet {
          add(disposable: IDisposable): void {}
        }
        declare const disposables: DisposableSet;

        disposables.add(createDisposable());
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        const disposable = createDisposable();
        disposable.dispose();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        import type { JupyterFrontEndPlugin } from './fixtures/types';

        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        export const plugin: JupyterFrontEndPlugin<void> = {
          id: 'example:disposable',
          activate: () => {
            const disposable = createDisposable();
            console.log(disposable);
          }
        };
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        function forwardDisposable(): IDisposable {
          return createDisposable();
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare const widget: {
          readonly disposed: {
            connect(callback: () => void): void;
          };
        };

        const disposable = createDisposable();
        widget.disposed.connect(() => {
          disposable.dispose();
        });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createEditor(): IDisposable;
        declare const sourceViewer: {
          open(options: { editorWrapper: IDisposable }): void;
        };

        const editorWrapper = createEditor();
        sourceViewer.open({ editorWrapper });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createOutput(): IDisposable;
        declare const outputArea: {
          _wrappedOutput(output: IDisposable, executionCount?: number | null): IDisposable;
        };

        function createWrappedOutput(): IDisposable {
          const output = createOutput();
          return outputArea._wrappedOutput(output, null);
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        class Owner {
          private _disposable: IDisposable | null = null;

          initialize(): void {
            this._disposable = this._disposable || createDisposable();
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        createDisposable().dispose();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        class Owner {
          private _disposable: IDisposable | null = null;

          initialize(): void {
            this._disposable = createDisposable();
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        class DisposableSet {
          add(disposable: IDisposable): void {}
        }
        declare const disposables: DisposableSet;

        const disposable = createDisposable();
        disposables.add(disposable);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        class MainAreaWidget {
          constructor(options: { content: IDisposable }) {}
          dispose(): void {}
        }

        const content = createDisposable();
        new MainAreaWidget({ content }).dispose();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare function showDialog(options: { body: IDisposable }): void;

        const body = createDisposable();
        showDialog({ body });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare const statusBar: {
          registerStatusItem(
            id: string,
            options: { item: IDisposable }
          ): IDisposable;
        };

        const item = createDisposable();
        statusBar.registerStatusItem('status', { item });
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare const layout: {
          insertWidget(index: number, widget: IDisposable): void;
        };

        const widget = createDisposable();
        layout.insertWidget(0, widget);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const widgets: IDisposable[];
        declare const owner: {
          addWidget(widget: IDisposable): void;
        };

        const widget = widgets.pop();
        if (widget) {
          owner.addWidget(widget);
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const manager: {
          findWidget(path: string): IDisposable | undefined;
        };

        const widget = manager.findWidget('path');
        console.log(widget);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function _findWidgetByID(id: string): IDisposable | undefined;

        const widget = _findWidgetByID('main');
        console.log(widget);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }

        class PanelHandler {
          private _findWidgetByID(id: string): IDisposable | undefined {
            return undefined;
          }

          find(id: string): void {
            const widget = this._findWidgetByID(id);
            console.log(widget);
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function dataToMenu(data: object): IDisposable;

        dataToMenu({});
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare const shell: {
          add(disposable: IDisposable): void;
        };

        const disposable = createDisposable();
        shell.add(disposable);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        class DisposableSet {
          static from(items: Iterable<IDisposable>): DisposableSet {
            return new DisposableSet();
          }
          dispose(): void {}
        }

        const disposables = DisposableSet.from([]);
        disposables.dispose();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        class DisposableSet {
          static from(items: Iterable<IDisposable>): DisposableSet {
            return new DisposableSet();
          }
          dispose(): void {}
        }

        const disposables = DisposableSet.from([createDisposable()]);
        disposables.dispose();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        class DisposableSet {
          static from(items: Iterable<IDisposable>): DisposableSet {
            return new DisposableSet();
          }
          dispose(): void {}
        }

        const disposable = createDisposable();
        const disposables = DisposableSet.from([disposable]);
        disposables.dispose();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable | undefined;
        class DisposableSet {
          add(disposable: IDisposable): void {}
        }
        declare const disposables: DisposableSet;

        const disposable = createDisposable();
        if (disposable) {
          disposables.add(disposable);
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        function createOptions(): { disposable: IDisposable } {
          return {
            disposable: createDisposable()
          };
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        class Owner {
          private _state: { disposable: IDisposable } | null = null;

          initialize(): void {
            this._state = {
              disposable: createDisposable()
            };
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const ArrayExt: {
          insert<T>(array: T[], index: number, value: T): void;
        };
        declare function createDisposable(): IDisposable;

        class Owner {
          private _items: IDisposable[] = [];

          addItem(): void {
            const item = createDisposable();
            ArrayExt.insert(this._items, 0, item);
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare const toolbar: {
          insertBefore(before: string, name: string, item: IDisposable): void;
        };

        const item = createDisposable();
        toolbar.insertBefore('kernelName', 'read-only-indicator', item);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createRenderer(): IDisposable;
        class MimeContent {
          readonly isDisposed = false;
          constructor(options: { renderer: IDisposable }) {}
          dispose(): void {}
        }
        class MimeDocument {
          readonly isDisposed = false;
          constructor(options: { content: MimeContent }) {}
          dispose(): void {}
        }

        function createDocument(): MimeDocument {
          const renderer = createRenderer();
          const content = new MimeContent({ renderer });
          return new MimeDocument({ content });
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createSharedModel(): IDisposable;
        declare const factory: {
          createNew(options: { sharedModel: IDisposable }): IDisposable;
        };

        class Owner {
          private _model: IDisposable | null = null;

          initialize(): void {
            const sharedModel = createSharedModel();
            this._model = factory.createNew({ sharedModel });
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const store: {
          get(key: string): IDisposable;
        };

        const current = store.get('current');
        console.log(current);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const commands: {
          addCommand(id: string, options: object): IDisposable;
        };

        commands.addCommand('example:command', {});
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const registry: {
          add(id: string): IDisposable;
        };

        registry.add('example');
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const docManager: {
          open(path: string): IDisposable;
        };
        declare const tabBar: {
          addTab(title: object): IDisposable;
        };

        docManager.open('index.ipynb');
        tabBar.addTab({});
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function getCurrent(): IDisposable | null;
        declare function getManager(): IDisposable;
        declare function contextForWidget(widget: object): IDisposable | undefined;
        declare const widget: object;

        const current = getCurrent();
        getManager();
        contextForWidget(widget);
        console.log(current);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }

        class Shell {
          private _currentTabBar(): IDisposable | null {
            return null;
          }

          private _adjacentBar(): IDisposable | null {
            return null;
          }

          run(): void {
            const current = this._currentTabBar();
            const next = this._adjacentBar();
            console.log(current, next);
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const registry: {
          addFileType(options: object): IDisposable;
          addWidgetExtension(name: string): IDisposable;
          registerItem(name: string): IDisposable;
        };
        declare const tabs: {
          insertTab(index: number): IDisposable;
        };

        registry.addFileType({});
        registry.addWidgetExtension('cell');
        registry.registerItem('status');
        tabs.insertTab(0);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const item: IDisposable;
        declare const values: {
          set(id: string, item: IDisposable): IDisposable | undefined;
          delete(id: string): IDisposable | undefined;
        };

        values.set('item', item);
        values.delete('item');
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare function createMap(): {
          set(id: string, disposable: IDisposable): IDisposable;
          delete(id: string): IDisposable;
        };

        class Store {
          private _items = createMap();

          add(): void {
            const item = createDisposable();
            this._items.set('item', item);
            this._items.delete('item');
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        let current: IDisposable | null = null;
        function update(): void {
          current = createDisposable();
        }
        update();
        console.log(current);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        class Cell implements IDisposable {
          readonly isDisposed = false;
          dispose(): void {}
          initializeState(): this {
            return this;
          }
        }

        const cell = new Cell();
        cell.initializeState();
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const toolbarRegistry: {
          addToolbarFactory(name: string): IDisposable;
        };

        toolbarRegistry.addToolbarFactory('example');
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        class Base {
          constructor(options: { disposable: IDisposable }) {}
        }
        class Owner extends Base {
          constructor() {
            const disposable = createDisposable();
            super({ disposable });
          }
        }
      `
    },
    {
      filename: typeAwareFilename,
      options: [{ ownershipFunctionNames: ['ownDisposable'] }],
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare function ownDisposable(disposable: IDisposable): void;

        const disposable = createDisposable();
        ownDisposable(disposable);
      `
    },
    {
      filename: typeAwareFilename,
      code: `
        declare function createValue(): string;
        createValue();
      `
    }
  ],

  invalid: [
    {
      filename: typeAwareFilename,
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        createDisposable();
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'createDisposable' }
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
        declare const condition: boolean;
        declare function createDisposable(): IDisposable;
        declare const owner: {
          addWidget(widget: IDisposable): void;
        };

        const widget = createDisposable();
        if (condition) {
          owner.addWidget(widget);
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
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const condition: boolean;
        declare function createDisposable(): IDisposable;
        declare function showDialog(options: { body: IDisposable }): void;

        const body = createDisposable();
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
      options: [{ ignoredReturnFunctionNames: [] }],
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const item: IDisposable;
        declare function createMap(): {
          set(id: string, item: IDisposable): IDisposable;
        };

        class Store {
          private _items = createMap();

          add(): void {
            this._items.set('item', item);
          }
        }
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'set' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      options: [{ ignoredReturnFunctionNames: [] }],
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const registry: {
          add(id: string): IDisposable;
        };

        registry.add('example');
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'add' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      options: [{ ignoredReturnFunctionNames: [] }],
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const registry: {
          addFileType(options: object): IDisposable;
        };

        registry.addFileType({});
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'addFileType' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      options: [{ ignoredReturnFunctionNames: [] }],
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const commands: {
          addCommand(id: string, options: object): IDisposable;
        };

        commands.addCommand('example:command', {});
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'addCommand' }
        }
      ]
    },
    {
      filename: typeAwareFilename,
      options: [{ ignoredReturnFunctionNames: [] }],
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const toolbarRegistry: {
          addToolbarFactory(name: string): IDisposable;
        };

        toolbarRegistry.addToolbarFactory('example');
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'addToolbarFactory' }
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
        interface IObservableDisposable extends IDisposable {
          readonly disposed: unknown;
        }
        declare function createObservableDisposable(): IObservableDisposable;

        createObservableDisposable();
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'createObservableDisposable' }
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
        declare function createDisposable(): IDisposable;

        void createDisposable();
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'createDisposable' }
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
        declare function createDisposable(): IDisposable;

        const disposable = createDisposable();
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
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        function createLeak(): void {
          const disposable = createDisposable();
        }

        function disposeOther(disposable: IDisposable): void {
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
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const condition: boolean;
        declare function createDisposable(): IDisposable;

        const disposable = createDisposable();
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
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare function defer(callback: () => void): void;

        const disposable = createDisposable();
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
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare const condition: boolean;
        declare function createDisposable(): IDisposable;
        declare const widget: {
          readonly disposed: {
            connect(callback: () => void): void;
          };
        };

        const disposable = createDisposable();
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
      options: [{ ownershipFunctionNames: [] }],
      code: `
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;
        declare const items: { add(disposable: IDisposable): void };

        const disposable = createDisposable();
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
        declare function createDisposable(): IDisposable;

        let disposable = createDisposable();
        disposable = createDisposable();
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
        interface IDisposable {
          readonly isDisposed: boolean;
          dispose(): void;
        }
        declare function createDisposable(): IDisposable;

        let disposable: IDisposable;
        disposable = createDisposable();
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
        declare function createDisposable(): IDisposable;
        class Owner {
          constructor(disposable: IDisposable) {}
        }

        new Owner(createDisposable());
      `,
      errors: [
        {
          messageId: 'unhandledDisposable',
          data: { name: 'createDisposable' }
        }
      ]
    }
  ]
});
