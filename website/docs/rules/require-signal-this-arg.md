# `require-signal-this-arg`

Require a `thisArg` when connecting a class method that references `this` to a Lumino signal.

## Incorrect

```ts
class NotebookWatcher {
  constructor(model: IModel) {
    // this._onChanged uses `this` internally — it will not be bound
    // to this instance when the signal fires.
    model.changed.connect(this._onChanged);
  }

  private _onChanged(): void {
    this.update();
  }
}
```

## Correct

```ts
class NotebookWatcher {
  constructor(model: IModel) {
    model.changed.connect(this._onChanged, this);
  }

  private _onChanged(): void {
    this.update();
  }
}
```

```ts
// Arrow-function property: `this` is captured lexically, so there is no
// runtime bug. Passing the thisArg anyway lets Signal.clearData(this) remove
// the connection (see prefer-signal-this-arg).
class NotebookWatcher {
  constructor(model: IModel) {
    model.changed.connect(this._onChanged, this);
  }

  private _onChanged = (): void => {
    this.update();
  };
}
```

```ts
// Wrapping in an arrow also binds `this` lexically — again, the thisArg is
// what makes the connection removable by Signal.clearData(this).
class NotebookWatcher {
  constructor(model: IModel) {
    model.changed.connect((sender, args) => {
      this.handleChange(sender, args);
    }, this);
  }
}
```

## Why

Passing a class method to `connect()` does not bind it to the instance. If that method uses `this`, it can throw or read the wrong object when the signal fires. Passing `this` as the second argument gives it the intended receiver.

Arrow functions already capture `this`, but a receiver can still help with cleanup; see [prefer-signal-this-arg](../prefer-signal-this-arg) and the [JupyterLab signal patterns](https://jupyterlab.readthedocs.io/en/latest/developer/patterns.html#signals).

## Options

This rule has no options.

## Fixing a report

The editor suggestion adds `this` as the second argument. Review the change: if you also call `signal.disconnect(this._onChanged)`, update it to `signal.disconnect(this._onChanged, this)` so it still matches the connection. This is a suggestion rather than an automatic fix.

<details>
<summary>Scope and limitations</summary>

The rule checks class methods that use `this` and are passed to `connect()` without a second argument. It skips arrow-function properties, methods that do not use `this`, accessors and methods it cannot find in the enclosing class.

Calls inside nested regular functions are skipped because their `this` may refer to another object. When type information is available, APIs known not to be Lumino signals are ignored.

</details>
