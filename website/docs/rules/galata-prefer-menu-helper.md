# `galata-prefer-menu-helper`

Prefer Galata's `page.menu` helper over raw Playwright selectors for JupyterLab main menu traversal.

## Incorrect

```ts
await page.click('text=File');
await page.click('.lm-Menu ul[role="menu"] >> text=New');
await page.click('#jp-mainmenu-file-new >> text=Terminal');
await page.click('li[role="menuitem"]:has-text("Kernel")');
await page.locator('.lm-MenuBar-item').getByText('File').click();
await page.getByRole('menuitem', { name: 'Settings' }).click();
```

## Correct

```ts
await page.menu.clickMenuItem('File>New>Terminal');
await page.menu.openLocator('File');
await page.menu.closeAll();
```

## Why

Raw clicks depend on which menu is already open and when its submenus appear. `page.menu.clickMenuItem()` closes open menus, follows the requested path and waits for each submenu. This makes a sequence such as opening a terminal easier to read and less prone to timing failures.

## Options

This rule has no options.

<details>
<summary>Scope and limitations</summary>

The rule checks main menu interactions, including locator chains and locators stored in unchanged `const` bindings. It does not recommend the main menu helper for context menus or toolbar dropdowns.

For generic menu selectors, the main menu must have been opened earlier in the same test. A `#jp-mainmenu-*` selector identifies a main menu directly. Bare labels such as `File` are checked only when the test title mentions a menu or the test contains menu markup. These limits avoid confusing menu items with files or dialog buttons.

Menu state is tracked only within the current test; calls into named helpers are not followed.

</details>
