# `token-format`

Use `<package>:<TokenSymbol>` for JupyterLab token IDs.

## Incorrect

```ts
export const IFooService = new Token<IFooService>(
  '@test/pkg:foo-service',
  'A foo service'
);
```

## Correct

```ts
export const IFooService = new Token<IFooService>(
  '@test/pkg:IFooService',
  'A foo service'
);
```

## Why

Including the package name and service symbol makes a token easy to identify. The part after `:` must start with a letter, `_` or `$` and contain only those characters or digits. A missing `:` is also reported.

For example, include the package when naming a service token:

```ts
// Incorrect: no package/symbol separator.
new Token<IFooService>('IFooService', 'A foo service');

// Correct
new Token<IFooService>('@test/pkg:IFooService', 'A foo service');
```

## Options

This rule has no options.

<details>
<summary>Which token IDs are checked?</summary>

The rule checks string literals passed to `new Token(...)`. Variables and template literals are not checked.

</details>
