# `prefer-signal-this-arg`

Pass `this` when connecting a signal that can outlive the receiving object, so disposal can remove the connection.

## Incorrect

```ts
class SettingsPanel extends Widget {
  constructor(registry: ISettingRegistry) {
    super();
    // This callback stays connected after the panel is disposed.
    registry.pluginChanged.connect(() => this.update());
  }
}
```

## Correct

```ts
class SettingsPanel extends Widget {
  constructor(registry: ISettingRegistry) {
    super();
    registry.pluginChanged.connect(() => this.update(), this);
  }
}
```

## Why

A settings registry lives longer than the panels that use it. Without a receiver, its signal keeps the callback connected after a panel is disposed. Passing `this` lets the inherited `Widget.dispose()` remove that connection.

The same applies to a notebook model shared by multiple views: closing one view should remove its callbacks without disposing the model.

This rule covers cleanup. For unbound methods that fail when called, see [require-signal-this-arg](../require-signal-this-arg).

## Type-aware checking

:::info Requires type information

Enable [type-aware linting](https://typescript-eslint.io/getting-started/typed-linting/) for this rule. Without it, the rule reports nothing.

:::

## Fixing a report

The editor suggestion adds `this` to the connection. For `callback.bind(this)`, it also removes the bind. Review matching `disconnect()` calls before accepting: the callback and receiver must match the original connection.

A matching one-argument `disconnect(callback)` already provides cleanup and is left alone. Adding a receiver only to `connect()` would break that match.

## More examples

A bound method can be connected without creating a new function:

```ts
// Incorrect: each bind() creates a new callback.
service.model.currentFrameChanged.connect(this._onFrameChanged.bind(this));

// Correct: Widget.dispose() can remove this connection.
service.model.currentFrameChanged.connect(this._onFrameChanged, this);
```

These calls belong in a widget receiving a longer-lived debugger service. For a class that does not already clean up its connections, adding `this` alone is not enough; see [require-signal-cleanup](../require-signal-cleanup).

## Options

- `longLivedTypes` (`string[]`): type names treated as application-lifetime services. **Replaces** the built-in list when provided. The default is:

  `CommandRegistry`, `IDebugger`, `IDocumentManager`, `ILSPConnection`, `ILabShell`, `ILanguageServerManager`, `IRenderMimeRegistry`, `ISessionConnection`, `ISessionContext`, `ISettingRegistry`, `IShell`, `IStateDB`, `IThemeManager`, `ServiceManager`

```json
{
  "jupyter/prefer-signal-this-arg": [
    "warn",
    { "longLivedTypes": ["ISettingRegistry", "IMyAppService"] }
  ]
}
```

<details>
<summary>Scope and limitations</summary>

The rule reports only when the sender is a known long-lived service, or a model used by a Lumino widget, and the receiving class already has receiver-based cleanup. Senders owned and disposed by that class, its own signals and `disposed` signals are left alone.

Unknown lifetimes are not reported. Add your own application services with `longLivedTypes`. The model/view check requires a Lumino widget; other view-like classes are not covered. Cleanup in another file cannot be detected.

</details>
