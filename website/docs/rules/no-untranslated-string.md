# `no-untranslated-string`

Wrap user-facing text in a translation call such as `trans.__()`.

## Incorrect

```ts
commands.addCommand('file-download', { label: 'Download' });
node.setAttribute('aria-label', 'Download file');
```

## Correct

```ts
commands.addCommand('file-download', { label: trans.__('Download') });
node.setAttribute('aria-label', trans.__('Download file'));
```

## Why

Untranslated labels remain in the original language even when users select a different language for JupyterLab. Translate visible text and accessibility labels so both sighted users and screen reader users receive localized text.

## More examples

### Widget and dialog text

```ts
// Incorrect
this.title.label = 'Source';
showDialog({ title: 'Confirm', body: 'Are you sure?' });
Dialog.okButton({ label: 'Build' });

// Correct
this.title.label = trans.__('Source');
showDialog({ title: trans.__('Confirm'), body: trans.__('Are you sure?') });
Dialog.okButton({ label: trans.__('Build') });
```

The same applies to text assigned to DOM properties or passed in options:

```ts
// Incorrect
element.textContent = 'Save';
new MyField({ ...options, label: 'My field' });
launcher.add({ command, category: 'Notebook' });

// Correct
element.textContent = trans.__('Save');
new MyField({ ...options, label: trans.__('My field') });
launcher.add({ command, category: trans.__('Notebook') });
```

### JSX text and attributes

```tsx
// Incorrect
const message = <span>Error message:</span>;
const checkbox = <MyCheckbox label="Enable feature" />;

// Correct
const message = <span>{trans.__('Error message:')}</span>;
const checkbox = <MyCheckbox label={trans.__('Enable feature')} />;
```

### Conditional text

Translate each possible message, including fallback values:

```tsx
// Incorrect
const button = <button title={visible ? 'Hide layer' : 'Show layer'} />;
const options = { label: name ?? 'Untitled' };

// Correct
const button = (
  <button title={visible ? trans.__('Hide layer') : trans.__('Show layer')} />
);
const options = { label: name ?? trans.__('Untitled') };
```

## Options

Defaults:

```json
{
  "enforcePunctuation": false,
  "checkProperties": [
    "alt",
    "aria-description",
    "aria-label",
    "caption",
    "category",
    "label",
    "placeholder",
    "title",
    "tooltip",
    "textContent",
    "innerText"
  ]
}
```

### `enforcePunctuation`

Set to `true` to require translation of punctuation such as `/`, `-` and `+`. Blank strings and bare numbers are never reported.

```ts
// Reported only when enforcePunctuation is true.
item.textContent = '/';
```

### `checkProperties`

Names of object properties, DOM attributes, assignment targets and JSX attributes to check. Hyphenated and camelCase spellings are equivalent: either `aria-label` or `ariaLabel` covers both.

This list **replaces** the defaults. Pass `[]` to turn off these configurable checks. Command text, dialog text, dialog button labels and JSX text are still checked.

<details>
<summary>Which text is checked?</summary>

The rule checks string literals and template literals without interpolation in:

- Command `label`, `caption` and `usage` properties, including concise arrow functions returning text.
- `showDialog()` and `new Dialog()` titles and bodies.
- Labels passed to `Dialog.okButton()`, `cancelButton()`, `warnButton()` and `errorButton()`.
- JSX text, including string literals inside braces.
- The names in `checkProperties`, on any object or element.

Conditional branches and fallback expressions are checked separately. Because property checks apply regardless of the receiving object, a configured name can also match text that is not shown to users. Adjust `checkProperties` or disable the rule for an intentional exception.

</details>
