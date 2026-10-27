import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { requestPrediction } from '../src/api.js';

const file = new Blob(['test image'], { type: 'image/png' });
const options = { baseUrl: 'http://127.0.0.1:5002' };

test('unsupported format preserves the API error instead of creating a prediction', async () => {
  await assert.rejects(requestPrediction(file, {
    ...options,
    fetchImpl: async () => ({ ok: false, status: 415, json: async () => ({ error: 'Unsupported image format. Use JPEG, PNG, WEBP or AVIF.' }) }),
  }), /Unsupported image format/);
});

test('unavailable model preserves the backend explanation', async () => {
  await assert.rejects(requestPrediction(file, {
    ...options,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: 'Model unavailable.' }) }),
  }), /Model unavailable/);
});

test('network failure reports a connection problem', async () => {
  await assert.rejects(requestPrediction(file, {
    ...options, fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  }), /Cannot reach the image-analysis server/);
});

test('non-JSON error reports its HTTP status', async () => {
  await assert.rejects(requestPrediction(file, {
    ...options,
    fetchImpl: async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError(); } }),
  }), /HTTP 502/);
});

test('a successful HTTP response with an error label cannot become a classification', async () => {
  await assert.rejects(requestPrediction(file, {
    ...options,
    fetchImpl: async () => ({ ok: true, json: async () => ({ detection: 'Error', confidence: 0 }) }),
  }), /invalid prediction/);
});

test('invalid numeric scores cannot become a classification', async () => {
  for (const confidence of [NaN, Infinity, -1, 101, '90']) {
    await assert.rejects(requestPrediction(file, {
      ...options,
      fetchImpl: async () => ({ ok: true, json: async () => ({ detection: 'Real', confidence }) }),
    }), /invalid prediction/);
  }
});

test('valid model result is returned unchanged', async () => {
  const prediction = { detection: 'Deepfake', confidence: 88, explanation: 'Check the source.' };
  const result = await requestPrediction(file, {
    ...options, fetchImpl: async () => ({ ok: true, json: async () => prediction }),
  });
  assert.deepEqual(result, prediction);
});

let AnalysisSummary;
before(async () => {
  const source = await readFile(new URL('../src/AnalysisSummary.jsx', import.meta.url), 'utf8');
  const compiled = await transformWithEsbuild(source, 'AnalysisSummary.jsx', {
    loader: 'jsx', jsx: 'automatic', format: 'cjs',
  });
  const module = { exports: {} };
  runInNewContext(compiled.code, {
    module, exports: module.exports, require: createRequire(import.meta.url),
  });
  AnalysisSummary = module.exports.default;
});

test('error rendering contains no deepfake label or fabricated score', () => {
  const html = renderToStaticMarkup(createElement(AnalysisSummary, {
    error: 'Unsupported image format.',
    result: { detection: 'Deepfake', confidence: 0 },
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Analysis unavailable/);
  assert.match(html, /Unsupported image format/);
  assert.doesNotMatch(html, /Likely AI-generated|Deepfake Detected|Model score/);
});

test('successful rendering includes the actual prediction and score', () => {
  const html = renderToStaticMarkup(createElement(AnalysisSummary, {
    result: { detection: 'Real', confidence: 77.08, explanation: 'Check the source.' },
  }));
  assert.match(html, /Likely real/);
  assert.match(html, /77.08/);
  assert.match(html, /Check the source/);
  assert.doesNotMatch(html, /Analysis unavailable/);
});

test('attention evidence is displayed with an uncertainty caption', () => {
  const html = renderToStaticMarkup(createElement(AnalysisSummary, {
    result: { detection: 'Deepfake', confidence: 83, visual_evidence: {
      summary: 'The upper left influenced this result.', overlay: 'data:image/png;base64,fixture',
    } },
  }));
  assert.match(html, /What influenced this result/);
  assert.match(html, /upper left/);
  assert.match(html, /not proven manipulation/);
});

test('IBM image observations are distinguished from classifier influence', () => {
  const html = renderToStaticMarkup(createElement(AnalysisSummary, {
    result: { detection: 'Deepfake', confidence: 83, explanation: 'Possible clues: unusual edge blending.',
      visual_review: { status: 'success' } },
  }));
  assert.match(html, /IBM visual review: possible clues/);
  assert.match(html, /unusual edge blending/);
  assert.match(html, /can differ from the local classifier/);
});

test('failed visual review is visible alongside the available local prediction', () => {
  const html = renderToStaticMarkup(createElement(AnalysisSummary, {
    result: { detection: 'Real', confidence: 75, visual_review: {
      status: 'unavailable', error: 'IBM could not complete the visual review.',
    } },
  }));
  assert.match(html, /Likely real/);
  assert.match(html, /IBM could not complete/);
});
