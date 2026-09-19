# `require-soft-assertions-before-snapshots`

Require `expect.soft()` for snapshot assertions that are not the last in a Playwright test block.

## Incorrect

```ts
test('multi-step screenshot', async ({ page }) => {
  expect(await page.screenshot()).toMatchSnapshot('step-1.png'); // ❌ not last, must be soft
  await page.click('button');
  expect(await page.screenshot()).toMatchSnapshot('step-2.png'); // ❌ not last, must be soft
  expect.soft(await page.screenshot()).toMatchSnapshot('step-3.png');
});
```

## Correct

```ts
test('multi-step screenshot', async ({ page }) => {
  expect.soft(await page.screenshot()).toMatchSnapshot('step-1.png');
  await page.click('button');
  expect.soft(await page.screenshot()).toMatchSnapshot('step-2.png');
  expect(await page.screenshot()).toMatchSnapshot('step-3.png'); // last — hard is fine
});
```

A single snapshot per test requires no change:

```ts
test('single screenshot', async ({ page }) => {
  expect(await page.screenshot()).toMatchSnapshot('page.png'); // only snapshot — fine
});
```

## Why

A hard snapshot assertion stops the test at its first failure. Later screenshots are never captured, so you cannot inspect all visual changes from that run. Use `expect.soft()` to continue to the remaining snapshots while still failing the test if any assertion fails. The last snapshot can use either form.

## Options

This rule has no options.

<details>
<summary>Which assertions are checked?</summary>

The rule checks `toMatchSnapshot()` assertions in `test()` and `it()` callbacks, including modifiers and hooks such as `test.only()` and `test.beforeEach()`. Other assertions, such as `toBeVisible()` and `toHaveScreenshot()`, are not checked.

</details>
