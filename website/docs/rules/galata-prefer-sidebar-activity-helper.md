# `galata-prefer-sidebar-activity-helper`

Prefer Galata's sidebar and activity helpers over raw Playwright selectors when opening sidebar tabs or activating main area tabs.

## Incorrect

```ts
await page.click('[title="Running Terminals and Kernels"]');
await page.locator('[title="Property Inspector"]').click();
await page.getByRole('tab', { name: 'File Browser' }).click();
await page.click('div[role="main"] >> text=Lorenz.ipynb');
```

## Correct

```ts
await page.sidebar.openTab('jp-running-sessions');
await page.sidebar.openTab('jp-property-inspector');
await page.sidebar.openTab('filebrowser');
await page.activity.activateTab('Lorenz.ipynb');
```

## Why

Raw title and text selectors depend on user-facing labels and do not wait for JupyterLab's tab activation state. Galata's helpers target stable tab identifiers or activity names and include the activation checks that make tests less flaky.

## Options

This rule has no options.

<details>
<summary>Which tab interactions are checked?</summary>

The rule checks clicks on known sidebar tab titles, equivalent `getByRole('tab', { name })` locators, and text selectors scoped to main area tabs.

</details>
