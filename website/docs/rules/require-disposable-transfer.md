# `require-disposable-transfer`

Require calls returning `IDisposable` to transfer ownership to a caller, field,
or disposable collection.

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

## Why

Functions that return `IDisposable` hand cleanup responsibility to the caller.
Ignoring the returned value usually means the cleanup path has been lost.

## Usage

By default, the rule checks factory-named calls such as `create*`, `make*`, `build*` and `new*` that return a disposable. Type-aware linting is needed to identify these return types; the known Lumino `DisposableSet.from()` and `ObservableDisposableSet.from()` factories are recognized without it.

Values created directly in a Jupyter plugin’s `activate()` function are exempt because they commonly live for the application lifetime. A reported value can be returned, assigned to a field, put in a disposable collection, passed to an ownership helper or disposed. Keeping it in a local variable without arranging cleanup is not enough.

## Options

### `ownershipFunctionNames`

Function or method names that take ownership of disposable arguments, such as
`add`, `addWidget`, `insertWidget`, and `registerStatusItem`. For the full
default list see the
[`DEFAULT_OWNERSHIP_FUNCTION_NAMES`](https://github.com/search?q=repo%3Ajupyterlab%2Feslint-plugin+const+DEFAULT_OWNERSHIP_FUNCTION_NAMES&type=code)
constant. Names given here are **added** to that default list.

### `extendDefaultOwnershipFunctionNames`

Type: `boolean`, default: `true`.

Set to `false` to replace the default ownership list instead of extending it.
With no `ownershipFunctionNames` of your own, `false` drops the defaults
entirely.

### `ignoredReturnFunctionNames`

Function or method names whose disposable return value should be treated as
borrowed, or as owned by a registration or session API. Names given here are
**added** to the defaults, which include `get`, `find`, `addCommand`, `open`, `register`, `set` and `transform`.

Use this option with `checkAllDisposableReturns` to exempt APIs that return borrowed objects or registration handles. The default checks only factory-named calls.

### `extendDefaultIgnoredReturnFunctionNames`

Type: `boolean`, default: `true`.

Set to `false` to replace the default ignore list instead of extending it. This
also drops the two pattern-based default exemptions, `add*Factory` and
`this._map.set(...)` / `this._map.delete(...)`, since those are part of the same
defaults. With no `ignoredReturnFunctionNames` of your own, `false` ignores
nothing at all.

### `checkAllDisposableReturns`

Type: `boolean`, default: `false`.

By default only factory-named calls (`create*`, `build*`, `make*`, `new*`) have
their disposable return value checked, because any call _might_ return a
disposable and reporting all of them is too noisy. Set this to `true` to check
every call whose return type is disposable.

Extending the defaults, the common case:

```json
{
  "jupyter/require-disposable-transfer": [
    "warn",
    {
      "ownershipFunctionNames": ["ownDisposable", "registerDisposable"],
      "ignoredReturnFunctionNames": ["borrowWidget"]
    }
  ]
}
```

Strictest possible checking, dropping every default exemption:

```json
{
  "jupyter/require-disposable-transfer": [
    "warn",
    {
      "extendDefaultOwnershipFunctionNames": false,
      "extendDefaultIgnoredReturnFunctionNames": false,
      "checkAllDisposableReturns": true
    }
  ]
}
```

<details>
<summary>Other recognized ownership patterns</summary>

With type information, passing a disposable to a parameter declared as a disposable type counts as a handoff, including through an options object. Configured ownership helper names work without that type information.

The rule also accepts class-field collections, exported bindings and unconditional disposal in a callback. These patterns establish an owner; they do not guarantee that the owner eventually disposes the resource.

</details>
