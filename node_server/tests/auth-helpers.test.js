const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidUsername,
  normalizeUsername,
  buildDefaultNickname,
} = require('../auth-helpers');

test('accepts usernames made of letters numbers and underscores', () => {
  assert.equal(isValidUsername('user_1234'), true);
});

test('rejects usernames shorter than 4 chars', () => {
  assert.equal(isValidUsername('abc'), false);
});

test('rejects usernames with hyphen or chinese chars', () => {
  assert.equal(isValidUsername('user-name'), false);
  assert.equal(isValidUsername('用户1234'), false);
});

test('normalizes username by trimming only', () => {
  assert.equal(normalizeUsername('  user_1234  '), 'user_1234');
});

test('builds default nickname distinct from username', () => {
  const nickname = buildDefaultNickname('user_1234');
  assert.match(nickname, /^用户[A-Z0-9]{6}$/);
  assert.notEqual(nickname, 'user_1234');
});
