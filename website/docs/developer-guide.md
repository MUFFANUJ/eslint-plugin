# Developer Guide

## Bug reporting

If you've found a bug, please [create a new issue](https://github.com/jupyterlab/eslint-plugin/issues/new) or [submit a pull request](https://github.com/jupyterlab/eslint-plugin/pulls) on GitHub.

## Development Workflow

To set up the development environment and run the project:

```bash
npm install
npm run build
npm test
```

### Adding or Changing a Rule

1. Implement rule logic under `src/rules`
2. Add tests under `tests`
3. Build and run tests
4. Add or update rule documentation under `website/docs/rules`

Start each rule page with a short description and incorrect/correct examples.
Explain the user-visible problem with concrete examples, then document options
and practical caveats. Keep secondary technical details in `<details>` sections.
Leave implementation details already covered by tests or code comments out of
the rule documentation.

### Documentation Workflow

To run the documentation site locally:

```bash
npm run docs:start
```

## Architecture

### Plugin Entrypoint

The plugin is exported from `src/index.ts` and contains:

- `rules`: individual lint rules
- `configs.recommended`: ready-to-use ruleset for flat config
- `configs.recommended-legacy`: ready-to-use ruleset for legacy `.eslintrc`

### Rule Design

Each rule is implemented as an ESLint `RuleModule` with:

- Metadata (`meta.docs`, `meta.messages`, `meta.schema`)
- AST listeners in `create(context)`
- Focused helper utilities under `src/utils`

### Current Rule Set

For a detailed list of all available rules, see the [rules documentation](../rules).
