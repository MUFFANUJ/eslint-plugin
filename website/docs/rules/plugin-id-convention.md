# `plugin-id-convention`

Ensure JupyterLab plugin IDs are prefixed with the extension package name.

## Why

JupyterLab treats the part of a plugin ID before the first `:` as the extension
name when it disables, defers or locks all plugins of an extension. A plugin
shipped under a different prefix is skipped by deferring and locking, and by
`jupyter labextension disable package-name` up to JupyterLab 4.6. From
JupyterLab 4.7, disabling by package name disables every plugin the package
provides, and the browser console warns about each plugin whose ID does not
follow the convention.

## Rule details

The rule reads the nearest JupyterLab extension `package.json` and reports
plugin IDs that do not start with `<package name>:`.

MIME renderer extension entries (`IRenderMime.IExtension`) are registered as
plugins under their `id`, so the rule checks them the same way, in packages
that declare `jupyterlab.extension` or `jupyterlab.mimeExtension`.

For example, in a package with this manifest:

```json
{
  "name": "@jupyterlab/example-extension",
  "jupyterlab": {
    "extension": true
  }
}
```

A plugin whose ID is exactly the package name, with no `:` part, is not
reported by default. Such an ID does not follow the convention, but
`disabledExtensions`, `deferredExtensions` and `lockedExtensions` match it in
full, so it has no user impact. Set `reportIdEqualToPackageName` to
report such an ID.

## Incorrect

The plugin ID uses a different package prefix, so extension-level
configuration for `@jupyterlab/example-extension` does not apply to this plugin.

```ts
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/other-extension:plugin',
  autoStart: true,
  activate: () => {}
};
```

A MIME renderer entry under a different prefix is skipped the same way.

```ts
const extension: IRenderMime.IExtension = {
  id: '@jupyterlab/other-extension:factory',
  rendererFactory
};
```

## Correct

The plugin ID starts with the package name followed by `:`.

```ts
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/example-extension:plugin',
  autoStart: true,
  activate: () => {}
};
```

```ts
const extension: IRenderMime.IExtension = {
  id: '@jupyterlab/example-extension:factory',
  rendererFactory
};
```

## Limitations

Renaming a plugin that has shipped has a cost. A `disabledExtensions`,
`deferredExtensions` or `lockedExtensions` entry that names the plugin in full
stops matching. If the plugin loads its settings under its own ID, as
JupyterLab's own plugins do, the user settings and any `overrides.json` entry
stay under the old ID as well. The extension can migrate the user settings
while a schema for the old ID is still served, which for a prefix that belonged
to another package is the case only while a package of that name is installed:

```ts
import { ISettingRegistry } from '@jupyterlab/settingregistry';

const OLD_ID = '@my-org/unconventional:plugin';

const plugin: JupyterFrontEndPlugin<void> = {
  id: '@my-org/conventional:plugin',
  autoStart: true,
  requires: [ISettingRegistry],
  activate: async (_app: JupyterFrontEnd, registry: ISettingRegistry) => {
    const settings = await registry.load(plugin.id);
    // If nothing was saved under the new ID yet...
    if (Object.keys(settings.user).length === 0) {
      // ...copy the old settings once.
      // Note: by using `connector.fetch` rather than `registry.load` we
      // prevent the old ID from showing up in the settings editor.
      const old = await registry.connector.fetch(OLD_ID).catch(() => undefined);
      if (old && Object.keys(old.data.user).length > 0) {
        await settings.save(old.raw);
        await registry.connector.save(OLD_ID, '{}');
      }
    }
  }
};
```

Entries in `overrides.json` and in the page config are deployment configuration
and have to be updated there. When that cost is too high, keep the ID and add an
`eslint-disable-next-line jupyter/plugin-id-convention` comment with the reason.

## Options

```ts
{
  "reportIdEqualToPackageName": false
}
```

### `reportIdEqualToPackageName`

Set to `true` to also report a plugin whose ID is exactly the package name. The
report asks for the `<package>:<plugin>` form.

```ts
// Not reported by default; reported when reportIdEqualToPackageName is true
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/example-extension',
  activate: () => {}
};
```

### Technical details

The ID can be a string literal or assembled from constant strings:

- a template literal, a `+` concatenation, a `const` that copies another,
  or a member of a `const` object;
- with type information, anything whose type is a string literal type: a
  `const` imported from another module, a namespace member or an enum member.

An ID the rule cannot resolve to a string, such as one built
from a reassigned variable or a function call, is not checked.
