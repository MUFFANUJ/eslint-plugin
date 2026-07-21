/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    'user-guide',
    'developer-guide',
    {
      type: 'category',
      label: 'Rules',
      link: {
        type: 'generated-index',
        title: 'Rules'
      },
      items: [
        'rules/index',
        'rules/command-described-by',
        'rules/incorrect-translator-usage',
        'rules/no-pageconfig-base-url',
        'rules/no-schema-enum',
        'rules/no-translation-concatenation',
        'rules/no-untranslated-string',
        'rules/plugin-activation-args',
        'rules/plugin-description',
        'rules/require-disposable-ownership',
        'rules/require-disposable-transfer',
        'rules/require-soft-assertions-before-snapshots',
        'rules/token-format'
      ]
    }
  ]
};

export default sidebars;
