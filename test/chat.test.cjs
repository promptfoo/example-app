const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

// Every provider request is mocked; no API credentials or running LiteLLM required.
process.env.LITELLM_SERVER_URL = 'http://litellm.invalid';
const { chatHandler } = require('../dist/routes/chat');

async function chat({ level = 'minnow', query = {}, body = { messages: 'Hello' } } = {}) {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  await chatHandler({ params: { level }, query, body }, res);
  return res;
}

const invalidRequests = [
  ['invalid fish level', { level: 'secure' }, 'Invalid path parameter', /level:/],
  ['unknown model', { query: { model: 'not-configured' } }, 'Invalid query parameters', /model: Model must be one of/],
  ['invalid domain', { query: { domain: 'unknown' } }, 'Invalid query parameters', /domain:/],
  ['unknown query key', { query: { extra: 'value' } }, 'Invalid query parameters', /extra/],
  ['repeated model query', { query: { model: ['gpt-5-mini', 'gpt-5-mini'] } }, 'Invalid query parameters', /model:/],
  ['empty message list', { body: { messages: [] } }, 'Invalid request body', /messages:/],
  ['non-string content', { body: { messages: [{ role: 'user', content: 42 }] } }, 'Invalid request body', /messages\.0\.content:/],
  ['missing message role', { body: { messages: [{ content: 'Hello' }] } }, 'Invalid request body', /messages\.0\.role:/],
];

for (const [name, request, error, message] of invalidRequests) {
  test(`returns a structured 400 for ${name}`, async (t) => {
    const provider = t.mock.method(globalThis, 'fetch', async () => {
      throw new Error('Invalid requests must not reach LiteLLM');
    });
    const res = await chat(request);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, error);
    assert.match(res.body.message, message);
    assert.equal(provider.mock.callCount(), 0);
  });
}

for (const domain of ['general', 'finance', 'medicine', 'vacation-rental', 'taxes']) {
  for (const [fish, promptLevel] of [['minnow', 'insecure'], ['shark', 'secure']]) {
    test(`preserves ${domain}/${fish} prompt and model routing`, async (t) => {
      const completion = { choices: [{ message: { role: 'assistant', content: 'Hello back' } }] };
      const provider = t.mock.method(globalThis, 'fetch', async () => ({
        ok: true,
        json: async () => completion,
      }));
      const messages = [{ role: 'user', content: 'Hello' }];
      const model = 'claude-3-5-haiku-latest';
      const res = await chat({ level: fish, query: { domain, model }, body: { messages } });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, completion);
      assert.equal(provider.mock.callCount(), 1);
      const [url, options] = provider.mock.calls[0].arguments;
      assert.equal(url, 'http://litellm.invalid/v1/chat/completions');
      assert.equal(options.method, 'POST');
      assert.deepEqual(options.headers, { 'Content-Type': 'application/json' });
      const prompt = readFileSync(path.join(__dirname, '../src/domains', domain, `${promptLevel}.txt`), 'utf8').trim();
      assert.deepEqual(JSON.parse(options.body), {
        model,
        messages: [{ role: 'system', content: prompt }, ...messages],
      });
    });
  }
}

const message = { role: 'user', content: 'Hello' };
for (const [name, messages] of [
  ['plain text', 'Hello'],
  ['message array', [message]],
  ['JSON array', JSON.stringify([message])],
  ['JSON object', JSON.stringify(message)],
]) {
  test(`normalizes ${name} with the default model and domain`, async (t) => {
    const provider = t.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => ({ choices: [] }),
    }));
    const res = await chat({ body: { messages } });
    assert.equal(res.statusCode, 200);
    assert.equal(provider.mock.callCount(), 1);
    const sent = JSON.parse(provider.mock.calls[0].arguments[1].body);
    assert.equal(sent.model, 'gpt-5-mini');
    assert.deepEqual(sent.messages, [
      { role: 'system', content: readFileSync(path.join(__dirname, '../src/domains/general/insecure.txt'), 'utf8').trim() },
      message,
    ]);
  });
}

test('preserves LiteLLM error status and response text', async (t) => {
  const provider = t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 503,
    text: async () => 'Provider temporarily unavailable',
  }));
  const res = await chat();
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    error: 'LiteLLM server error',
    message: 'Provider temporarily unavailable',
  });
  assert.equal(provider.mock.callCount(), 1);
});
