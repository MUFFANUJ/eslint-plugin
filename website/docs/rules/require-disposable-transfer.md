# `require-disposable-transfer`

Require calls returning `IDisposable` to transfer ownership to a caller, field,
or disposable collection.

## Why

Functions that return `IDisposable` hand cleanup responsibility to the caller.
Ignoring the returned value usually means the cleanup path has been lost.

## Rule details

This rule checks call expressions whose return type is compatible with
`IDisposable` or `IObservableDisposable` when TypeScript type information is
available. It also recognizes the known Lumino factories
`DisposableSet.from(...)` and `ObservableDisposableSet.from(...)`.

It accepts common ownership patterns:

- Adding the result to a typed `DisposableSet` or a conventionally named
  disposable collection such as `this._disposables.add(...)`
- Passing the result as a direct array item to `DisposableSet.from(...)` or
  `ObservableDisposableSet.from(...)`
- Returning the result
- Assigning it to an object field
- Calling `.dispose()` immediately
- Storing it in a variable that is later added, returned, assigned to a field,
  or disposed
- Passing it to a configured ownership helper function or default ownership
  sink such as `add`, `addCell`, `addItem`, `addWidget`, `insertWidget`,
  or `registerStatusItem`
- Passing it through an owned constructor options object, such as
  `new MainAreaWidget({ content })`

By default, the rule does not report common borrowed-reference,
fluent-initializer, or registration-return calls such as `get`, `find`,
`getCurrent`, `contextForWidget`, `insertCell`, `insertTab`,
`initializeState`, `contextMenuWidget`, `add`, `addCommand`, `addFileType`,
`addItem`, `addWidgetExtension`, `addToolbarButtonClass`,
`addCommandToolbarButtonClass`, `openInspector`, `openOrReveal`,
`findWidget`, `widgetAt`, `widgetRenderer`, `pop`, `shift`, `registerItem`,
`registerStatusItem`, `addKeyBinding`, `addGroup`, `register`, `transform`,
and `add*Factory`.

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
`addSibling`, `addWidget`, `addWidgetFactory`, `insertItem`, `insertWidget`,
and `registerStatusItem`. If provided, this list replaces the default. Set this
option to `[]` to require stricter typed ownership checks.

### `ignoredReturnFunctionNames`

Function or method names whose disposable return value should be treated as
borrowed or owned by a registration/session API. If provided, this list
replaces the default. Set this option to `[]` to report ignored registration
return values.

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
