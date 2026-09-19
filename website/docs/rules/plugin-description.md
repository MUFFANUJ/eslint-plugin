# `plugin-description`

Ensure all `JupyterFrontEndPlugin` objects define a non-empty `description` property.

## Incorrect

```ts
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'test-plugin:plugin',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('Activated');
  }
};
```

## Correct

```ts
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'test-plugin:plugin',
  description: 'Test plugin used for lint rule examples',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('Activated');
  }
};
```

## Why

A description tells maintainers and integrators what a plugin does without requiring them to read its activation code. Use a short, meaningful description; an empty or whitespace-only string is also reported.

## Options

This rule has no options.
