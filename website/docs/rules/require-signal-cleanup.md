# `require-signal-cleanup`

Disconnect from long-lived services when disposing the object that listens to them.

## Incorrect

```ts
class SettingsWatcher implements IDisposable {
  constructor(registry: ISettingRegistry) {
    // The registry keeps this watcher alive until it disconnects.
    registry.pluginChanged.connect(this._onChanged, this);
  }

  isDisposed = false;

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    // Marking this watcher as disposed does not disconnect it.
  }

  private _onChanged(): void {
    /* ... */
  }
}
```

## Correct

```ts
// Receiver-based cleanup removes every connection made with `this`
class SettingsWatcher implements IDisposable {
  constructor(registry: ISettingRegistry) {
    registry.pluginChanged.connect(this._onChanged, this);
  }

  isDisposed = false;

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    Signal.clearData(this);
  }

  private _onChanged(): void {
    /* ... */
  }
}
```

## Why

A long-lived service can keep a discarded object alive through its signal connections. The callback may then keep running after the object is disposed. Clear its connections during disposal, or explicitly disconnect each callback with the same receiver used to connect it.

## Type-aware checking

:::info Requires type information

Enable [type-aware linting](https://typescript-eslint.io/getting-started/typed-linting/) for this rule. Without it, the rule reports nothing.

:::

## Other cleanup patterns

To remove a specific connection, keep a reference to the sender and use the same callback and receiver:

```ts
this._registry.pluginChanged.disconnect(this._onChanged, this);
```

Lumino widgets inherit cleanup from `Widget.dispose()`. An overridden `dispose()` must call `super.dispose()` to preserve it.

This rule checks connections made with `this` as the receiver. For connections without a receiver, see [require-signal-this-arg](../require-signal-this-arg) and [prefer-signal-this-arg](../prefer-signal-this-arg).

## Options

- `longLivedTypes` (`string[]`): type names treated as application-lifetime services. **Replaces** the built-in list when provided. The default is:

  `CommandRegistry`, `IDebugger`, `IDocumentManager`, `ILSPConnection`, `ILabShell`, `ILanguageServerManager`, `IRenderMimeRegistry`, `ISessionConnection`, `ISessionContext`, `ISettingRegistry`, `IShell`, `IStateDB`, `IThemeManager`, `ServiceManager`

- `additionalCleanupMethods` (`string[]`, default `[]`): additional method names (besides `disconnect`) that count as cleanup evidence when called anywhere in the class. Use this to whitelist project-specific teardown idioms.

```json
{
  "jupyter/require-signal-cleanup": [
    "warn",
    {
      "longLivedTypes": ["ISettingRegistry", "IMyAppService"],
      "additionalCleanupMethods": ["_stopObserving"]
    }
  ]
}
```

<details>
<summary>Scope and limitations</summary>

The rule checks disposable classes without a base class that connect to a known long-lived service. It skips owned senders, `disposed` signals, subclasses and classes without a disposal protocol. Add your own service types with `longLivedTypes`.

Any signal cleanup call, `disconnect()` call or configured cleanup method in the class suppresses reports for the whole class. It does not verify that every connection is removed, or that the owner actually calls `dispose()`. Cleanup performed elsewhere is not visible.

</details>
