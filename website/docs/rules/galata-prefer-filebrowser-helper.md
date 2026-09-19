# `galata-prefer-filebrowser-helper`

Prefer Galata's `page.filebrowser` and `page.notebook` helpers over raw Playwright selectors for JupyterLab file browser interactions.

## Incorrect

```ts
await page.dblclick('[aria-label="File Browser Section"] >> text=notebooks');
await page.dblclick('text=Data.ipynb');
await page.click('.jp-BreadCrumbs-home svg');
await page.locator('.jp-DirListing-item').dblclick();
await page.locator('#filebrowser').getByText('notebooks').dblclick();
```

## Correct

```ts
await page.notebook.openByPath('notebooks/Data.ipynb');
await page.filebrowser.openHomeDirectory();
await page.filebrowser.openDirectory('notebooks');
await page.filebrowser.open('data/bar.json');
// The file selector dialog is out of scope
await page.locator('.jp-Dialog .jp-DirListing-itemName').first().dblclick();
```

## Why

Raw file browser selectors depend on markup that can change and can skip readiness checks. The helpers open intermediate directories and wait for the document tab; `page.notebook.openByPath()` also waits for the notebook panel to be ready.

Use `openDirectory()` when opening a directory itself. `open()` waits for a document tab, which opening a directory does not create.

## Options

This rule has no options.

## Configuration

Use the Galata `page` fixture to make these helpers available. The rule also reports raw interactions on a plain Playwright fixture named `page`; disable it for files where you intentionally use that fixture.

<details>
<summary>Scope and limitations</summary>

The rule checks direct `page` interactions and locator chains containing file browser selectors. It skips file selector dialogs because the helpers operate on the sidebar. Locators stored in variables are not tracked.

A double-clicked name without a dot is treated as a directory name. Review the suggested helper if your files or directories use a different naming convention.

</details>
