# `require-disposable-ownership`

Require newly created disposable objects to be owned, returned, assigned to a
field, or disposed.

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
  constructor() {
    this._disposables.add(new DisposableDelegate(() => cleanup()));
  }

  dispose(): void {
    this._disposables.dispose();
  }

  private _disposables = new DisposableSet();
}
```

## Why

Lumino `IDisposable` objects represent lifecycle cleanup. Creating a disposable
and then dropping it usually leaks resources or callbacks that should have been
released later.

## Usage

The rule checks objects created with `new`, including known Lumino disposable classes. Type-aware linting also recognizes other disposable types.

Values created directly in a Jupyter plugin’s `activate()` function are exempt because they commonly live for the application lifetime. A reported value can be returned, assigned to a field, put in a disposable collection, passed to an ownership helper or disposed. Keeping it in a local variable without arranging cleanup is not enough.

## Options

### `ownershipFunctionNames`

Use this option for ownership helpers that the rule cannot recognize from their parameter types.

Function or method names that take ownership of disposable arguments, such as
`add`, `addWidget`, `insertWidget`, and `registerStatusItem`. For the full
default list see the
[`DEFAULT_OWNERSHIP_FUNCTION_NAMES`](https://github.com/search?q=repo%3Ajupyterlab%2Feslint-plugin+const+DEFAULT_OWNERSHIP_FUNCTION_NAMES&type=code)
constant.

Names given here are **added** to that default list, so a project only has to
name its own ownership helpers:

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

### `extendDefaultOwnershipFunctionNames`

Type: `boolean`, default: `true`.

Set to `false` to replace the default list instead of extending it. With no
`ownershipFunctionNames` of your own, `false` drops the defaults entirely, which
is how to ask for the strictest typed ownership checking:

```json
{
  "jupyter/require-disposable-ownership": [
    "warn",
    { "extendDefaultOwnershipFunctionNames": false }
  ]
}
```

<details>
<summary>Other recognized ownership patterns</summary>

With type information, passing a disposable to a parameter declared as a disposable type counts as a handoff, including through an options object. Configured ownership helper names work without that type information.

The rule also accepts class-field collections, exported bindings and unconditional disposal in a callback. These patterns establish an owner; they do not guarantee that the owner eventually disposes the resource.

</details>
