# `incorrect-translator-usage`

Store translation bundles under a name the translation extractor recognizes, such as `trans`.

## Incorrect

```ts
// Chained call — the string is never extracted
translator.load('jupyterlab').__('some-string');

// Unrecognized variable name
const someNameButNotTrans = translator.load('jupyterlab');
someNameButNotTrans.__('some-string');

// Unrecognized instance property name
this._bundle = translator.load('mydomain');
```

## Correct

```ts
const trans = translator.load('jupyterlab');
trans.__('some-string');

// In a class
this._trans = translator.load('mydomain');
this._trans.__('some-string');
```

## Why

A translation call can run correctly but still be missing from language packs. The extractor recognizes only `trans`, `this.trans`, `this._trans`, `props.trans` and `this.props.trans`. Use one of these names so your messages can be collected for translation.

See the [JupyterLab translation rules](https://jupyterlab.readthedocs.io/en/stable/extension/internationalization.html#rules).

## Options

This rule has no options.

<details>
<summary>Which bundle uses are checked?</summary>

The rule checks `.load()` calls on objects whose names contain `translator`, including `nullTranslator`. It reports unrecognized storage names, destructuring, and translation methods called directly on the returned bundle. Unrelated `.load()` APIs are ignored.

Passing a bundle to another function or returning it is allowed; the receiving code must store it under a recognized name.

</details>
