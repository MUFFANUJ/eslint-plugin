# `no-schema-enum`

Disallow `enum` in settings JSON schema files; use `oneOf` with `const`, `title`, and an explicit `type` instead.

## Incorrect

These choices display the stored values instead of translatable labels:

```json
{
  "properties": {
    "defaultZoom": {
      "type": "string",
      "enum": ["fit-to-width", "fit-to-height", "100%"]
    }
  }
}
```

Adding labels without declaring the setting's type is also reported:

```json
{
  "properties": {
    "defaultZoom": {
      "oneOf": [
        { "const": "fit-to-width", "title": "Fit to width" },
        { "const": "fit-to-height", "title": "Fit to height" },
        { "const": "100%", "title": "100%" }
      ]
    }
  }
}
```

## Correct

```json
{
  "properties": {
    "defaultZoom": {
      "type": "string",
      "oneOf": [
        { "const": "fit-to-width", "title": "Fit to width" },
        { "const": "fit-to-height", "title": "Fit to height" },
        { "const": "100%", "title": "100%" }
      ]
    }
  }
}
```

## Why

With `enum`, users see the stored values, such as `fit-to-width`, and those labels cannot be translated. With `oneOf`, each `title` provides a readable, translatable label while `const` preserves the stored value.

String choices also need `"type": "string"` on the containing setting so the settings editor can render the control. The rule can add a missing type automatically.

## Options

This rule has no options.

## Configuration

This rule checks JSON files inside a `schema/` directory. Configure [`jsonc-eslint-parser`](https://github.com/ota-meshi/jsonc-eslint-parser) (v2) for those files:

```js
import * as jsoncParser from 'jsonc-eslint-parser';
import jupyterPlugin from '@jupyter/eslint-plugin';

export default [
  {
    files: ['**/schema/*.json'],
    languageOptions: { parser: jsoncParser },
    plugins: { jupyter: jupyterPlugin },
    rules: {
      'jupyter/no-schema-enum': 'error'
    }
  }
];
```
