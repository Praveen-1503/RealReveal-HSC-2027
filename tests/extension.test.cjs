const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function worker(fetchMock) {
  let listener;
  const chrome = {
    runtime: {
      onMessage: { addListener(fn) { listener = fn; } },
      onInstalled: { addListener() {} },
    },
    contextMenus: { onClicked: { addListener() {} } },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../chrome-extension/background.js'), 'utf8'),
    { chrome, fetch: fetchMock, URL, AbortSignal, FormData, console },
  );
  return (url) => new Promise((resolve) => {
    const keepAlive = listener({ action: 'fetchAndAnalyze', imageUrl: url }, { tab: { id: 1 } }, resolve);
    assert.equal(keepAlive, true);
  });
}

test('worker downloads image then submits multipart to local API', async () => {
  const requests = [];
  const analyze = worker(async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) return { ok: true, blob: async () => new Blob(['image']) };
    return { ok: true, json: async () => ({ detection: 'Real', confidence: 80 }) };
  });
  const result = await analyze('https://example.org/photo.jpg');
  assert.equal(result.ok, true);
  assert.equal(result.result.detection, 'Real');
  assert.equal(requests[1].url, 'http://127.0.0.1:5002/predict');
  assert.equal(requests[1].options.method, 'POST');
  assert.ok(requests[1].options.body.get('file'));
});

test('worker rejects unsupported URLs before fetching', async () => {
  let fetched = false;
  const analyze = worker(async () => { fetched = true; });
  const result = await analyze('file:///private/image.jpg');
  assert.equal(result.ok, false);
  assert.equal(fetched, false);
});

test('worker reports blocked image downloads', async () => {
  const result = await worker(async () => ({ ok: false, status: 403 }))('https://example.org/photo.jpg');
  assert.equal(result.ok, false);
  assert.match(result.error, /403/);
});

test('worker reports structured API errors', async () => {
  let count = 0;
  const analyze = worker(async () => ++count === 1
    ? { ok: true, blob: async () => new Blob(['image']) }
    : { ok: false, json: async () => ({ error: 'Model unavailable' }) });
  const result = await analyze('https://example.org/photo.jpg');
  assert.equal(result.ok, false);
  assert.match(result.error, /Model unavailable/);
});

test('worker stops oversized images before calling the API', async () => {
  let count = 0;
  const analyze = worker(async () => {
    count++;
    return { ok: true, blob: async () => ({ size: 9 * 1024 * 1024 }) };
  });
  const result = await analyze('https://example.org/photo.jpg');
  assert.equal(result.ok, false);
  assert.equal(count, 1);
});

test('manifest icons and content assets exist', () => {
  const root = path.join(__dirname, '../chrome-extension');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  for (const asset of [...Object.values(manifest.icons), manifest.background.service_worker,
    ...manifest.content_scripts.flatMap(s => [...s.js, ...s.css])]) {
    assert.ok(fs.existsSync(path.join(root, asset)), asset);
  }
});
