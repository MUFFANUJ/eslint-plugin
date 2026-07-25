# `require-disposable-transfer`

Require calls returning `IDisposable` to transfer ownership to a caller, field,
or disposable collection.

## Why

Functions that return `IDisposable` hand cleanup responsibility to the caller.
Ignoring the returned value usually means the cleanup path has been lost.

## Rule details

This rule checks factory-like call expressions such as `create*`, `make*`,
`build*`, and `new*` whose return type is compatible with `IDisposable` or
`IObservableDisposable` when TypeScript type information is available. It also
recognizes the known Lumino factories `DisposableSet.from(...)` and
`ObservableDisposableSet.from(...)`. It ignores disposable values created
directly inside a typed Jupyter plugin `activate` function, where services
commonly live for the application lifetime.

It accepts common ownership patterns:

- Adding the result to a typed `DisposableSet` or a conventionally named
  disposable collection such as `this._disposables.add(...)`
- Passing the result as a direct array item to `DisposableSet.from(...)` or
  `ObservableDisposableSet.from(...)`
- Returning the result
- Assigning it to an object field
- Storing it in a class-field collection with `this._items.set(...)`
- Calling `.dispose()` immediately
- Storing it in a variable that is later added, returned, assigned to a field,
  or disposed
- Passing it to a configured ownership helper function or default ownership
  sink such as `add`, `addCell`, `addItem`, `addMenu`, `addWidget`,
  `insertWidget`, or `registerStatusItem`
- Passing it through a known owned constructor options object, such as
  `new MainAreaWidget({ content })` or `new Dialog({ body })`

By default, the rule does not report common borrowed-reference,
fluent-initializer, or registration-return calls such as `get`, `find`,
`getCurrent`, `contextForWidget`, `insertCell`, `insertTab`,
`initializeState`, `contextMenuWidget`, `add`, `addCommand`, `addFileType`,
`addItem`, `addWidgetExtension`, `addToolbarButtonClass`,
`addCommandToolbarButtonClass`, `addTab`, `delete`, `open`, `openInspector`,
`openOrReveal`, `findWidget`, `_findWidgetByID`, `widgetAt`,
`widgetRenderer`, `pop`, `shift`, `registerItem`, `registerStatusItem`,
`addKeyBinding`, `addGroup`, `register`, `set`, `transform`, and
`add*Factory`.

## Incorrect

```ts
createDisposable();
```

```ts
const disposable = createDisposable();
console.log(disposable);
```

## Correct

```ts
this._disposables.add(createDisposable());
```

```ts
const disposable = createDisposable();
disposable.dispose();
```

```ts
return createDisposable();
```

```ts
const disposables = DisposableSet.from([createDisposable()]);
disposables.dispose();
```

## Options

### `ownershipFunctionNames`

Function or method names that take ownership of disposable arguments. The
default list is `add`, `addCell`, `addFactory`, `addItem`, `addModelFactory`,
`addSibling`, `addMenu`, `addWidget`, `addWidgetFactory`, `insertItem`,
`insertWidget`, and `registerStatusItem`. If provided, this list replaces the
default. Set this option to `[]` to require stricter typed ownership checks.

### `ignoredReturnFunctionNames`

Function or method names whose disposable return value should be treated as
borrowed or owned by a registration/session API. If provided, this list
replaces the default and opts into stricter return checking for non-factory
calls. Set this option to `[]` to report ignored registration return values.

```json
{
  "jupyter/require-disposable-transfer": [
    "warn",
    {
      "ownershipFunctionNames": ["ownDisposable", "registerDisposable"],
      "ignoredReturnFunctionNames": ["addCommand", "get", "find"]
    }
  ]
}
```
