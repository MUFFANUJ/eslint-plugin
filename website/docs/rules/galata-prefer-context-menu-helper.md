# `galata-prefer-context-menu-helper`

Use Galata's document-opening helpers instead of navigating the file browser's `Open With` menu by hand.

## Incorrect

```ts
await page.click('.jp-DirListing-item >> text=notebook.ipynb', {
  button: 'right'
});
await page.hover('text=Open With');
await page.click('text=Notebook (no kernel)');
await page.waitForSelector('.jp-NotebookPanel');

await page.click('.jp-DirListing-item >> text=README.md', { button: 'right' });
await page.click('text=Open With');
await page.click('.lm-Menu-itemLabel:text("Markdown Preview")');

await page.menu.openContextMenu('.jp-DirListing-item >> text=data.csv');
await page.getByText('Open With').hover();
await page.getByRole('menuitem', { name: 'CSV Viewer' }).click();
```

## Correct

```ts
await page.notebook.open('notebook.ipynb', { noKernel: true });
await page.filebrowser.open('README.md', 'Markdown Preview');
await page.filebrowser.open('data.csv', 'CSV Viewer');
```

## Why

Opening a document by hand requires a right-click, a submenu interaction, a factory selection and a wait. Each step can break when the interface or its timing changes. The helpers express the intended action in one call and wait for the document to be revealed.

## Options

This rule has no options.

<details>
<summary>Which interactions are checked?</summary>

The rule reports the factory click after a file browser context menu and its `Open With` submenu have been opened in the same test. Waits between these steps are allowed. It recommends `page.notebook.open(name, { noKernel: true })` for the no-kernel notebook factory and `page.filebrowser.open(path, factory)` for other factories.

</details>
