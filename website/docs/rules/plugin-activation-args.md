# `plugin-activation-args`

Ensure JupyterLab plugin `activate` arguments match the order and count of `requires` and `optional` tokens.

## Incorrect

```ts
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'test-plugin',
  requires: [INotebookTracker, IRenderMimeRegistry],
  activate: (tracker: INotebookTracker, app: JupyterFrontEnd) => {
    console.log('Activated');
  }
};
```

## Correct

```ts
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'test-plugin',
  requires: [INotebookTracker, IRenderMimeRegistry],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    renderMime: IRenderMimeRegistry,
    translator: ITranslator | null
  ) => {
    console.log('Activated');
  }
};
```

## Why

JupyterLab passes the application first, followed by required services and then optional services, in the order their tokens are listed. A different signature can pass the wrong service to your code or leave an argument missing. Optional services may be absent, so their argument types must allow `null` or `undefined`.

For a `ServiceManagerPlugin`, the first argument is `null` instead of the application.

## Type-aware checking

Enable `parserOptions.project` or `projectService` in your ESLint configuration to check service argument types and order. Without type information, those checks are skipped and you may see warnings about token types that cannot be resolved.

## Options

```ts
{
  "allowedFirstArgumentNames": ["app", "_app", "_"]
}
```

Use this option to permit your team’s preferred name for the first `activate` argument.
