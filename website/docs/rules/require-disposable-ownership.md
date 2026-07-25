# `require-disposable-ownership`

Require newly created disposable objects to be owned, returned, assigned to a
field, or disposed.

## Why

Lumino `IDisposable` objects represent lifecycle cleanup. Creating a disposable
and then dropping it usually leaks resources or callbacks that should have been
released later.

## Rule details

The rule checks `new` expressions that create known disposable classes such as
`DisposableDelegate`, `ObservableDisposableDelegate`, `DisposableSet`, and
`ObservableDisposableSet`. When TypeScript type information is available, it
also detects objects typed as `IDisposable` or `IObservableDisposable`.
It ignores disposable objects created directly inside a typed Jupyter plugin
`activate` function, where services commonly live for the application lifetime.

It accepts common ownership patterns:

- Adding the object to a typed `DisposableSet` or a conventionally named
  disposable collection such as `this._disposables.add(...)`
- Passing the object as a direct array item to `DisposableSet.from(...)` or
  `ObservableDisposableSet.from(...)`
- Returning it
- Assigning it to an object field or class field initializer
- Storing it in a class-field collection with `this._items.set(...)`
- Calling `.dispose()` immediately
- Storing it in a variable that is later added, returned, assigned to a field,
  or disposed
- Passing it to a configured ownership helper function or default ownership
  sink such as `add`, `addCell`, `addItem`, `addMenu`, `addWidget`,
  `insertWidget`, or `registerStatusItem`
- Passing it through a known owned constructor options object, such as
  `new MainAreaWidget({ content })` or `new Dialog({ body })`
- Passing it as a `showDialog({ body: ... })` body or launching a typed
  `Dialog` with `.launch()`

## Incorrect

```ts
new DisposableDelegate(() => {
  cleanup();
});
```

```ts
const disposable = new DisposableDelegate(() => {
  cleanup();
});
console.log(disposable);
```

## Correct

```ts
this._disposables.add(
  new DisposableDelegate(() => {
    cleanup();
  })
);
```

```ts
return new DisposableDelegate(() => {
  cleanup();
});
```

```ts
const disposable = new DisposableDelegate(() => {
  cleanup();
});
disposable.dispose();
```

```ts
class Owner {
  private _disposables = new DisposableSet();
}
```

## Options

### `ownershipFunctionNames`

Function or method names that take ownership of disposable arguments. The
default list is `add`, `addCell`, `addFactory`, `addItem`, `addModelFactory`,
`addSibling`, `addMenu`, `addWidget`, `addWidgetFactory`, `insertItem`,
`insertWidget`, and `registerStatusItem`. If provided, this list replaces the
default. Set this option to `[]` to require stricter typed ownership checks.

```json
{
  "jupyter/require-disposable-ownership": [
    "warn",
    {
      "ownershipFunctionNames": ["ownDisposable", "registerDisposable"]
    }
  ]
}
```
