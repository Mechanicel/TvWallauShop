const assert = require('node:assert/strict');
const test = require('node:test');

test('frontend placeholder passes', () => {
  assert.equal(2 + 2, 4);
});

test('frontend placeholder truthy', () => {
  assert.ok('frontend');
});
