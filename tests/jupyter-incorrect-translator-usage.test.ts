/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import incorrectTranslatorUsage from '../src/rules/incorrect-translator-usage';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module'
    }
  }
});

ruleTester.run('incorrect-translator-usage', incorrectTranslatorUsage, {
  valid: [
    // The documented pattern
    { code: `const trans = translator.load('jupyterlab');` },
    { code: `const trans = this.translator.load('mydomain');` },
    { code: `const trans = this._translator.load('mydomain');` },
    { code: `const trans = props.translator.load('mydomain');` },
    { code: `const trans = nullTranslator.load('jupyterlab');` },
    { code: `const trans = translator!.load('mydomain');` },
    { code: `const trans = translator?.load('mydomain');` },
    { code: `let trans; trans = translator.load('mydomain');` },
    // Recognized bundle properties
    {
      code: `class A { private _trans = translator.load('jupyterlab'); }`
    },
    {
      code: `class A { constructor() { this.trans = translator.load('jupyterlab'); } }`
    },
    {
      code: `class A { constructor() { this._trans = this.translator.load('mydomain'); } }`
    },
    // Recognized bundle member targets
    { code: `this.props.trans = translator.load('mydomain');` },
    { code: `props.trans = translator.load('mydomain');` },
    // Object property named trans (used later as props.trans)
    { code: `const options = { trans: translator.load('mydomain') };` },
    // Passing the bundle along without storing it is fine; the receiver
    // stores it under a recognized name
    { code: `createWidget(translator.load('mydomain'));` },
    {
      code: `function loadBundle() { return translator.load('mydomain'); }`
    },
    // Regular bundle usage is out of scope for this rule
    { code: `trans.__('Hello');` },
    { code: `this._trans._n('%1 item', '%1 items', count);` },
    // load() on objects that are not translators
    { code: `const settings = registry.load('my-plugin:settings');` },
    { code: `const state = this.connector.load(id);` },
    { code: `settingRegistry.load(plugin.id).then(settings => {});` },
    // A chained bundle method on a non-translator .load() is out of scope
    { code: `i18n.load('mydomain').__('some text');` },
    { code: `registry.load('my-plugin').gettext('label');` },
    // The translator has to be an identifier or property to be recognized
    { code: `const bundle = getTranslator().load('mydomain');` },
    // Computed targets are not checked
    { code: `this['bundle'] = translator.load('mydomain');` },
    { code: `class A { ['bundle'] = translator.load('mydomain'); }` }
  ],

  invalid: [
    // Chained bundle method calls are not found by the string extractor
    {
      code: `translator.load('jupyterlab').__('some-string');`,
      errors: [{ messageId: 'chainedBundleMethod' }]
    },
    {
      code: `this.translator.load('mydomain')._n('%1 item', '%1 items', n);`,
      errors: [{ messageId: 'chainedBundleMethod' }]
    },
    {
      code: `nullTranslator.load('jupyterlab').gettext('some text');`,
      errors: [{ messageId: 'chainedBundleMethod' }]
    },
    {
      code: `translator!.load('mydomain').__('some text');`,
      errors: [{ messageId: 'chainedBundleMethod' }]
    },
    {
      code: `const label = translator.load('jupyterlab').__('label');`,
      errors: [{ messageId: 'chainedBundleMethod' }]
    },
    // Bundles stored under names the string extractor does not recognize
    {
      code: `const someNameButNotTrans = translator.load('jupyterlab'); someNameButNotTrans.__('some-string');`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `const bundle = translator.load('jupyterlab');`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    // Only bare `trans` is recognized, not bare `_trans`
    {
      code: `const _trans = translator.load('jupyterlab');`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `someName = translator.load('jupyterlab');`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `class A { constructor() { this.bundle = translator.load('jupyterlab'); } }`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    // `trans`/`_trans` on an unrecognized receiver is not seen by the extractor
    {
      code: `options.trans = translator.load('mydomain');`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `SomeClass.trans = translator.load('mydomain');`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `this.state._trans = translator.load('mydomain');`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `props._trans = translator.load('mydomain');`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `class A { private translationBundle = translator.load('jupyterlab'); }`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    // this.#trans is never recognized by the string extractor
    {
      code: `class A { #trans = translator.load('jupyterlab'); }`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `const options = { bundle: translator.load('mydomain') };`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `const options = { 'bundle': translator.load('mydomain') };`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    {
      code: `function f(bundle = translator.load('mydomain')) {}`,
      errors: [{ messageId: 'invalidBundleName' }]
    },
    // Destructuring hides the bundle from the string extractor
    {
      code: `const { __ } = translator.load('jupyterlab');`,
      errors: [{ messageId: 'destructuredBundle' }]
    },
    {
      code: `({ gettext } = translator.load('jupyterlab'));`,
      errors: [{ messageId: 'destructuredBundle' }]
    },
    {
      code: `function f({ __ } = translator.load('mydomain')) {}`,
      errors: [{ messageId: 'destructuredBundle' }]
    }
  ]
});
