# `galata-prefer-sidebar-activity-helper`

Prefer Galata's sidebar and activity helpers over raw Playwright selectors when opening sidebar tabs or activating main area tabs.

## Why

Raw title and text selectors depend on user-facing labels and do not wait for JupyterLab's tab activation state. Galata's helpers target stable tab identifiers or activity names and include the activation checks that make tests less flaky.

## Rule details

The rule reports activation-style calls such as `page.click(selector)` and `page.locator(selector).click()` when the selector directly targets:

- Known sidebar tabs by `title`, such as `Running Terminals and Kernels`, `Property Inspector`, `Table of Contents`, `Extension Manager`, `File Browser`, or `Debugger`.
- Main area tabs through `div[role="main"] >> text=<tab name>` selectors.

## Incorrect

```ts
await page.click('[title="Running Terminals and Kernels"]');
await page.locator('[title="Property Inspector"]').click();
await page.click('div[role="main"] >> text=Lorenz.ipynb');
```

## Correct

```ts
await page.sidebar.openTab('jp-running-sessions');
await page.sidebar.openTab('jp-property-inspector');
await page.activity.activateTab('Lorenz.ipynb');
```

## Options

This rule has no options.
