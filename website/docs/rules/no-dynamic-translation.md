# `no-dynamic-translation`

Require JupyterLab translation messages to be written as literals at the call
site.

## Incorrect

```ts
trans.__(`Delete ${fileName}`);
trans._n('%1 file', `${n} files`, n);

let text = `Kernel ${Text.titleCase(status)}`;
widget.node.textContent = trans.__(text);

const MESSAGE = 'Delete';
trans.__(MESSAGE);
```

## Correct

```ts
trans.__('Delete %1', fileName);
trans._n('%1 file', '%1 files', n);

widget.node.textContent = trans.__('Kernel %1', Text.titleCase(status));

trans.__('Delete');
```

## Why

The translation extractor reads messages from the source code without running it. It cannot extract an interpolated message or follow a variable to its definition, even a constant containing a string. Write the message in the translation call and pass changing values as placeholder arguments.

See the [JupyterLab translation rules](https://jupyterlab.readthedocs.io/en/stable/extension/internationalization.html#rules).

## Known limitation

The rule cannot tell that a value already reached the catalog by another route.
Settings schema text, for example, is extracted from the JSON itself, so
`trans._p('schema', schema.description)` is translated even though the argument
is not a literal — but it is still reported.

There is no option for this; silence the individual call site instead:

```ts
// eslint-disable-next-line jupyter/no-dynamic-translation
trans._p('schema', schema.description);
```

## Options

This rule has no options.

<details>
<summary>Which translation arguments are checked?</summary>

The rule checks message text and context arguments on `trans`, `this.trans`, `this._trans`, `props.trans` and `this.props.trans`. Placeholder values and plural counts can be dynamic.

Quoted strings and template literals without interpolation are accepted. Concatenation with `+` is handled by [no-translation-concatenation](../no-translation-concatenation).

</details>
