const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const modulePath = require.resolve('../dist/utils/litellm-config');

function withConfig(source, check) {
  const previousDirectory = process.cwd();
  const directory = mkdtempSync(path.join(tmpdir(), 'example-app-yaml-'));
  try {
    writeFileSync(path.join(directory, 'litellm_config.yaml'), source);
    process.chdir(directory);
    delete require.cache[modulePath];
    check(require(modulePath), directory);
  } finally {
    process.chdir(previousDirectory);
    delete require.cache[modulePath];
    rmSync(directory, { recursive: true });
  }
}

test('reads the repository model allowlist with the upgraded YAML parser', () => {
  delete require.cache[modulePath];
  const config = require(modulePath);
  try {
    assert.deepEqual(config.getAllowedModels(), ['gpt-5-mini', 'claude-3-5-haiku-latest']);
    assert.equal(config.isModelAllowed('gpt-5-mini'), true);
    assert.equal(config.isModelAllowed('not-configured'), false);
  } finally {
    delete require.cache[modulePath];
  }
});

test('supports ordinary YAML aliases and fallback model names', () => {
  withConfig(`defaults: &defaults
  model: local-fallback
model_list:
  - model_name: model_1000
    litellm_params: {model: local-primary}
  - litellm_params: {<<: *defaults}
`, (config) => {
    assert.deepEqual(config.getAllowedModels(), ['model_1000', 'local-fallback']);
    assert.equal(config.isModelAllowed('local-fallback'), true);
    assert.equal(config.isModelAllowed('local-primary'), false);
  });
});

test('preserves the cached allowlist when the configuration file changes', () => {
  withConfig('model_list: [{model_name: local-first}]\n', (config, directory) => {
    assert.deepEqual(config.getAllowedModels(), ['local-first']);
    writeFileSync(path.join(directory, 'litellm_config.yaml'), 'model_list: [{model_name: local-second}]\n');
    assert.deepEqual(config.getAllowedModels(), ['local-first']);
    assert.equal(config.isModelAllowed('local-first'), true);
    assert.equal(config.isModelAllowed('local-second'), false);
  });
});
