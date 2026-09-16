# `no-untranslated-string`

Require user-facing string literals to be wrapped in a translation call such as `trans.__()`.

## Rule details

The rule reports raw string literals (and template literals without expressions) in the following positions.

In every position, blank strings are never flagged, and neither are bare numbers. Strings of pure punctuation — such as `'/'` and `'-'` — can be translatable, but this rule only flags them when [`enforcePunctuation`](#enforcepunctuation) is on.

### 1. `commands.addCommand()` properties

The `label`, `caption`, and `usage` properties must not contain bare strings. Concise arrow functions returning a raw string (e.g. `() => 'string'`) are also flagged.

```ts
// Incorrect
commands.addCommand('file-download', { label: 'Download' });

// Correct
commands.addCommand('file-download', { label: trans.__('Download') });
commands.addCommand('file-download', { label: () => trans.__('Download') });
```

### 2. `element.setAttribute()`

Applies to the names in [`checkProperties`](#checkproperties).

```ts
// Incorrect
node.setAttribute('aria-label', 'main sidebar');

// Correct
node.setAttribute('aria-label', trans.__('main sidebar'));
```

### 3. Direct property assignment

Applies to the names in [`checkProperties`](#checkproperties), on any receiver. Because the receiver is not inspected, this also covers widget title properties such as `this.title.label`.

```ts
// Incorrect
element.title = 'Close Tab';
element.ariaLabel = 'Search results';
element.textContent = 'Save';
widget.label = 'Save';
this.title.label = 'Source';

// Correct
element.title = trans.__('Close Tab');
element.ariaLabel = trans.__('Search results');
element.textContent = trans.__('Save');
widget.label = trans.__('Save');
this.title.label = trans.__('Source');
```

### 4. `showDialog()` and `new Dialog()` options

The `title` and `body` options must not be raw strings.

```ts
// Incorrect
showDialog({ title: 'Confirm', body: 'Are you sure?' });

// Correct
showDialog({ title: trans.__('Confirm'), body: trans.__('Are you sure?') });
```

### 5. Dialog button builder labels

Applies to `Dialog.okButton`, `Dialog.cancelButton`, `Dialog.warnButton`, and `Dialog.errorButton`.

```ts
// Incorrect
Dialog.okButton({ label: 'Build' });

// Correct
Dialog.okButton({ label: trans.__('Build') });
```

### 6. JSX text content

Raw text between JSX tags and string literals inside `{...}` expressions are flagged.

```tsx
// Incorrect
const el = <span>Error message:</span>;
const el = <span>{'raw string'}</span>;

// Correct
const el = <span>{trans.__('Error message:')}</span>;
```

### 7. JSX attributes

Applies to the names in [`checkProperties`](#checkproperties), on any element.

```tsx
// Incorrect
const el = <span aria-label="Close" />;
const el = <MyCheckbox label="Enable feature" />;

// Correct
const el = <span aria-label={trans.__('Close')} />;
const el = <MyCheckbox label={trans.__('Enable feature')} />;
```

### 8. Object properties

Applies to the names in [`checkProperties`](#checkproperties), in any object literal — this catches labels handed to widgets and components the rule knows nothing about.

```ts
// Incorrect
new MyField({ ...options, label: 'My field' });
launcher.add({ command, category: 'Notebook' });

// Correct
new MyField({ ...options, label: trans.__('My field') });
launcher.add({ command, category: trans.__('Notebook') });
```

### Conditional values

In every position above, a conditional is read one branch at a time, so each string that can reach the user needs its own translation call. This covers `? :`, `||`, `??` and `&&`.

```tsx
// Incorrect
const el = <button title={visible ? 'Hide layer' : 'Show layer'} />;
node.textContent = count ? 'Some files' : 'No files';
const opts = { label: name ?? 'Untitled' };

// Correct
const el = (
  <button title={visible ? trans.__('Hide layer') : trans.__('Show layer')} />
);
node.textContent = count ? trans.__('Some files') : trans.__('No files');
const opts = { label: name ?? trans.__('Untitled') };
```

## Options

```ts
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

Set to `true` to enforce translation of punctuation characters such as `,`, `-`, `+`, and other symbols. It has no effect on bare numbers, which are never flagged.

```ts
// Not flagged by default; flagged when enforcePunctuation is true
item.textContent = '/';
anchor.textContent = '+';
const el = <span>,</span>;
```

### `checkProperties`

The names checked in sections 2, 3, 7 and 8 above — object literal properties, `setAttribute()` attributes, assignment targets and JSX attributes all share this one list, so a name can never apply in one of those positions but not another.

The list **replaces** the default rather than adding to it. Pass `[]` to turn those four checks off; the `addCommand`, dialog, dialog button and JSX text checks (sections 1, 4, 5 and 6) are not configurable and stay on.

Hyphenated and camelCase spellings are the same entry, so listing either `aria-label` or `ariaLabel` covers both the `aria-label` attribute and the `ariaLabel` DOM property.
