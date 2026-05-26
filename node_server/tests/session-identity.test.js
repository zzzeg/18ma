const test = require('node:test');
const assert = require('node:assert/strict');

const { signUserTokenPayload } = require('../auth-helpers');

test('builds jwt payload from userId username and role', () => {
  const payload = signUserTokenPayload({
    id: 7,
    username: 'user_1234',
    role: 'admin',
  });

  assert.deepEqual(payload, {
    userId: 7,
    username: 'user_1234',
    role: 'admin',
  });
});
