# `no-translation-concatenation`

Forbid concatenating dynamic values into JupyterLab translation messages.

## Incorrect

```ts
this.trans.__('Hello ' + userName);
trans._p('menu ' + section, 'Open');
trans._n('%1 file', '%1 ' + word, n);
```

## Correct

```ts
this.trans.__('Hello %1', userName);
trans._p('menu', 'Open');
trans._n('%1 file', '%1 files', n);

// Literal concatenation is still readable, so it stays fine:
trans.__('Part 1 of long message.\n' + 'Part 2 of long message.\n');
```

## Why

Building a message with `+` and a variable prevents the translation extractor from collecting the complete message. Use placeholders to keep the message intact and let translators choose where each value belongs. Concatenating only literal strings is allowed, for example to split a long message across source lines.

See the [JupyterLab translation rules](https://jupyterlab.readthedocs.io/en/stable/extension/internationalization.html#rules).

## Options

This rule has no options.

<details>
<summary>Which translation arguments are checked?</summary>

The rule checks concatenated message text and contexts on `trans`, `this.trans`, `this._trans`, `props.trans` and `this.props.trans`. Placeholder values, plural counts and the catalog domain can be dynamic.

For variables, interpolated templates and other dynamic messages, see [no-dynamic-translation](../no-dynamic-translation).

</details>
