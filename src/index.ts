/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import * as jsoncParser from 'jsonc-eslint-parser';
import pluginActivationArgs from './rules/plugin-activation-args';
import commandDescribedBy from './rules/command-described-by';
import pluginDescription from './rules/plugin-description';
import noTranslationConcatenation from './rules/no-translation-concatenation';
import noDynamicTranslation from './rules/no-dynamic-translation';
import tokenFormat from './rules/token-format';
import noUntranslatedString from './rules/no-untranslated-string';
import noSchemaEnum from './rules/no-schema-enum';
import requireSoftAssertionsBeforeSnapshots from './rules/require-soft-assertions-before-snapshots';
import noPageconfigBaseUrl from './rules/no-pageconfig-base-url';
import requireSignalCleanup from './rules/require-signal-cleanup';
import requireSignalThisArg from './rules/require-signal-this-arg';
import preferSignalThisArg from './rules/prefer-signal-this-arg';
import galataPreferFilebrowserHelper from './rules/galata-prefer-filebrowser-helper';
import requireDisposableOwnership from './rules/require-disposable-ownership';
import requireDisposableTransfer from './rules/require-disposable-transfer';
import incorrectTranslatorUsage from './rules/incorrect-translator-usage';
import galataPreferSidebarActivityHelper from './rules/galata-prefer-sidebar-activity-helper';

const plugin = {
  rules: {
    'plugin-activation-args': pluginActivationArgs,
    'command-described-by': commandDescribedBy,
    'plugin-description': pluginDescription,
    'no-translation-concatenation': noTranslationConcatenation,
    'no-dynamic-translation': noDynamicTranslation,
    'token-format': tokenFormat,
    'no-untranslated-string': noUntranslatedString,
    'no-schema-enum': noSchemaEnum,
    'require-soft-assertions-before-snapshots':
      requireSoftAssertionsBeforeSnapshots,
    'no-pageconfig-base-url': noPageconfigBaseUrl,
    'require-signal-cleanup': requireSignalCleanup,
    'require-signal-this-arg': requireSignalThisArg,
    'prefer-signal-this-arg': preferSignalThisArg,
    'galata-prefer-filebrowser-helper': galataPreferFilebrowserHelper,
    'require-disposable-ownership': requireDisposableOwnership,
    'require-disposable-transfer': requireDisposableTransfer,
    'incorrect-translator-usage': incorrectTranslatorUsage,
    'galata-prefer-sidebar-activity-helper': galataPreferSidebarActivityHelper
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
          'jupyter/no-dynamic-translation': 'warn',
          'jupyter/token-format': 'error',
          'jupyter/no-untranslated-string': 'warn',
          'jupyter/no-pageconfig-base-url': 'warn',
          'jupyter/require-signal-cleanup': 'warn',
          'jupyter/require-signal-this-arg': 'error',
          'jupyter/prefer-signal-this-arg': 'warn',
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
          'jupyter/require-soft-assertions-before-snapshots': 'warn',
          'jupyter/galata-prefer-filebrowser-helper': 'warn'
        }
      },
      {
        files: [
          '**/galata/test/**/*.ts',
          '**/galata/test/**/*.js',
          '**/ui-tests/**/*.spec.ts',
          '**/ui-tests/**/*.test.ts'
        ],
        rules: {
          'jupyter/galata-prefer-sidebar-activity-helper': 'warn'
        }
      }
    ],
    'recommended-legacy': {
      rules: {
        'jupyter/plugin-activation-args': 'error',
        'jupyter/command-described-by': 'warn',
        'jupyter/plugin-description': 'warn',
        'jupyter/no-translation-concatenation': 'error',
        'jupyter/no-dynamic-translation': 'warn',
        'jupyter/token-format': 'error',
        'jupyter/no-untranslated-string': 'warn',
        'jupyter/no-schema-enum': 'warn',
        'jupyter/no-pageconfig-base-url': 'warn',
        'jupyter/require-signal-cleanup': 'warn',
        'jupyter/require-signal-this-arg': 'error',
        'jupyter/prefer-signal-this-arg': 'warn',
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
            'jupyter/require-soft-assertions-before-snapshots': 'warn',
            'jupyter/galata-prefer-filebrowser-helper': 'warn'
          }
        },
        {
          files: [
            '**/galata/test/**/*.ts',
            '**/galata/test/**/*.js',
            '**/ui-tests/**/*.spec.ts',
            '**/ui-tests/**/*.test.ts'
          ],
          rules: {
            'jupyter/galata-prefer-sidebar-activity-helper': 'warn'
          }
        }
      ]
    }
  }
};

export = plugin;
