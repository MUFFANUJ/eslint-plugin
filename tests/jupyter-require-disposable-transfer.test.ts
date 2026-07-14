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
