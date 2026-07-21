# `incorrect-translator-usage`

Require translation bundles returned by `translator.load()` to be stored under an extractor-recognized name (e.g. `trans`, `this.trans`, `this._trans`, `props.trans`, `this.props.trans`).

## Why

JupyterLab collects translatable strings statically with a gettext-based extractor. The extractor only recognizes translation calls made through a small set of names:

- `trans`
- `this.trans`
- `this._trans`
- `this.props.trans`
- `props.trans`

Calling `__()` (or any other bundle method) directly on the result of `translator.load()`, or storing the bundle under any other name, silently hides those strings from the extractor: the code still runs, but the strings never end up in language packs and stay untranslated.
See [Rules](https://jupyterlab.readthedocs.io/en/stable/extension/internationalization.html#rules).

## Rule details

The rule reports:

- A translation bundle method (`__`, `_n`, `_p`, `_np`, `gettext`, `ngettext`, `pgettext`, `npgettext`, `dcnpgettext`) called directly on the result of a `<translator>.load(...)` call.
- The result of `<translator>.load(...)` stored under a name the extractor does not recognize — a variable or object property not named `trans`, or a member target other than `this.trans`, `this._trans`, `props.trans` or `this.props.trans`.
- Destructuring the result of `<translator>.load(...)`.

An object counts as a translator when its name contains `translator` (for example `translator`, `this._translator`, `props.translator` or `nullTranslator`). A chained bundle method or an unrecognized target only triggers the rule when the underlying `.load(...)` is called on such a translator; an unrelated `.load(...)` API is left alone. Passing the bundle directly to a function or returning it is not reported: the receiver is responsible for storing it under a recognized name.

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

## Options

This rule has no options.
