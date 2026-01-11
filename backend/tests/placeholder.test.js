const assert = require('node:assert/strict');
const test = require('node:test');

test('backend placeholder passes', () => {
  assert.equal(1 + 1, 2);
});

test('backend placeholder truthy', () => {
  assert.ok('backend');
});
