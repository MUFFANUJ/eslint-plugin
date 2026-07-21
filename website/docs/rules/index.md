# Rules

This section documents all rules currently provided by `eslint-plugin-jupyter`.

## Available rules

- [command-described-by](./command-described-by)
- [incorrect-translator-usage](./incorrect-translator-usage)
- [no-schema-enum](./no-schema-enum)
- [no-translation-concatenation](./no-translation-concatenation)
- [no-pageconfig-base-url](./no-pageconfig-base-url)
- [no-untranslated-string](./no-untranslated-string)
- [plugin-activation-args](./plugin-activation-args)
- [plugin-description](./plugin-description)
- [require-disposable-ownership](./require-disposable-ownership)
- [require-disposable-transfer](./require-disposable-transfer)
- [require-soft-assertions-before-snapshots](./require-soft-assertions-before-snapshots)
- [token-format](./token-format)

Each page includes intent, examples, configuration, and when to apply the rule.

## Recommended ruleset

The plugin ships with a recommended configuration that enables all current rules with the following defaults:

| Rule                                                                                           | Level    |
| ---------------------------------------------------------------------------------------------- | -------- |
| [jupyter/plugin-activation-args](./plugin-activation-args)                                     | `error`  |
| [jupyter/command-described-by](./command-described-by)                                         | `warn`   |
| [jupyter/no-untranslated-string](./no-untranslated-string)                                     | `warn`   |
| [jupyter/plugin-description](./plugin-description)                                             | `warn`   |
| [jupyter/no-translation-concatenation](./no-translation-concatenation)                         | `error`  |
| [jupyter/token-format](./token-format)                                                         | `error`  |
| [jupyter/require-disposable-ownership](./require-disposable-ownership)                         | `warn`   |
| [jupyter/require-disposable-transfer](./require-disposable-transfer)                           | `warn`   |
| [jupyter/require-soft-assertions-before-snapshots](./require-soft-assertions-before-snapshots) | `warn` ¹ |
| [jupyter/no-schema-enum](./no-schema-enum)                                                     | `warn` ² |
| [jupyter/no-pageconfig-base-url](./no-pageconfig-base-url)                                     | `warn`   |
| [jupyter/incorrect-translator-usage](./incorrect-translator-usage)                             | `warn`   |

¹ Applied only to `**/*.spec.{ts,js}` and `**/*.test.{ts,js}` files.  
² Applied only to `**/schema/*.json` files

These defaults are the same in both `jupyterPlugin.configs.recommended` (flat config) and `plugin:@jupyter/eslint-plugin/recommended-legacy`.

For guidance on using these recommended rules, see the [User Guide](../user-guide).
