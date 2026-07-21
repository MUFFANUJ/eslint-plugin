/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import * as jsoncParser from 'jsonc-eslint-parser';
import pluginActivationArgs from './rules/plugin-activation-args';
import commandDescribedBy from './rules/command-described-by';
import pluginDescription from './rules/plugin-description';
import noTranslationConcatenation from './rules/no-translation-concatenation';
import tokenFormat from './rules/token-format';
import noUntranslatedString from './rules/no-untranslated-string';
import noSchemaEnum from './rules/no-schema-enum';
import requireSoftAssertionsBeforeSnapshots from './rules/require-soft-assertions-before-snapshots';
import noPageconfigBaseUrl from './rules/no-pageconfig-base-url';
import requireDisposableOwnership from './rules/require-disposable-ownership';
import requireDisposableTransfer from './rules/require-disposable-transfer';
import incorrectTranslatorUsage from './rules/incorrect-translator-usage';

const plugin = {
  rules: {
    'plugin-activation-args': pluginActivationArgs,
    'command-described-by': commandDescribedBy,
    'plugin-description': pluginDescription,
    'no-translation-concatenation': noTranslationConcatenation,
    'token-format': tokenFormat,
    'no-untranslated-string': noUntranslatedString,
    'no-schema-enum': noSchemaEnum,
    'require-soft-assertions-before-snapshots':
      requireSoftAssertionsBeforeSnapshots,
    'no-pageconfig-base-url': noPageconfigBaseUrl,
    'require-disposable-ownership': requireDisposableOwnership,
    'require-disposable-transfer': requireDisposableTransfer,
    'incorrect-translator-usage': incorrectTranslatorUsage
  },
  configs: {
    recommended: [
      {
        files: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
        rules: {
          'jupyter/plugin-activation-args': 'error',
          'jupyter/command-described-by': 'warn',
          'jupyter/plugin-description': 'warn',
          'jupyter/no-translation-concatenation': 'error',
          'jupyter/token-format': 'error',
          'jupyter/no-untranslated-string': 'warn',
          'jupyter/no-pageconfig-base-url': 'warn',
          'jupyter/require-disposable-ownership': 'warn',
          'jupyter/require-disposable-transfer': 'warn',
          'jupyter/incorrect-translator-usage': 'warn'
        }
      },
      {
        files: ['**/schema/*.json'],
        languageOptions: { parser: jsoncParser },
        rules: {
          'jupyter/no-schema-enum': 'warn'
        }
      },
      {
        files: ['**/*.spec.ts', '**/*.spec.js', '**/*.test.ts', '**/*.test.js'],
        rules: {
          'jupyter/require-soft-assertions-before-snapshots': 'warn'
        }
      }
    ],
    'recommended-legacy': {
      rules: {
        'jupyter/plugin-activation-args': 'error',
        'jupyter/command-described-by': 'warn',
        'jupyter/plugin-description': 'warn',
        'jupyter/no-translation-concatenation': 'error',
        'jupyter/token-format': 'error',
        'jupyter/no-untranslated-string': 'warn',
        'jupyter/no-schema-enum': 'warn',
        'jupyter/no-pageconfig-base-url': 'warn',
        'jupyter/require-disposable-ownership': 'warn',
        'jupyter/require-disposable-transfer': 'warn',
        'jupyter/incorrect-translator-usage': 'warn'
      },
      overrides: [
        {
          files: [
            '**/*.spec.ts',
            '**/*.spec.js',
            '**/*.test.ts',
            '**/*.test.js'
          ],
          rules: {
            'jupyter/require-soft-assertions-before-snapshots': 'warn'
          }
        }
      ]
    }
  }
};

export = plugin;
