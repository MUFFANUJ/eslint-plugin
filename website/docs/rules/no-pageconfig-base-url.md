# `no-pageconfig-base-url`

Disallow calling `PageConfig.getBaseUrl()` outside of `makeSettings()`.

## Incorrect

```ts
// Stored on instance — URL can never change after construction
constructor(options: IOptions) {
  this._baseUrl = PageConfig.getBaseUrl();
}

// Captured in a closure at activation time
activate: (app: JupyterFrontEnd, paths: JupyterFrontEnd.IPaths) => {
  const url = URLExt.join(PageConfig.getBaseUrl(), paths.urls.themes);
  return new ThemeManager({ url });
};
```

## Correct

```ts
// Access baseUrl from stored settings each time it is needed
private async _requestAPI<T>(): Promise<T> {
  const settings = this._serverSettings;
  const requestUrl = URLExt.join(settings.baseUrl, API_PATH);
  const response = await ServerConnection.makeRequest(requestUrl, {}, settings);
  ...
}

// Pass serverSettings through and read baseUrl when needed
activate: (app: JupyterFrontEnd) => {
  const serverSettings = app.serviceManager.serverSettings;
  return new MyManager({ serverSettings });
};
```

## Why

JupyterLab can switch backend URLs at runtime. Reading `baseUrl` from the stored `ServerConnection.ISettings` each time allows requests to use the current backend. Calling `PageConfig.getBaseUrl()` or caching its result bypasses those settings.

## Exceptions

The rule reports every `PageConfig.getBaseUrl()` call. Disable it where that call is intentional, such as the implementation of `ServerConnection.makeSettings()`, or tests and examples of that API.

## Options

This rule has no options.
