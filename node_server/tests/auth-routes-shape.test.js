const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeRegisterPayload } = require('../auth-helpers');

test('normalizes register payload to username and password only', () => {
  const payload = normalizeRegisterPayload({
    username: '  user_1234  ',
    password: 'secret123',
    code: '123456',
    email: 'ignored@example.com',
  });

  assert.deepEqual(payload, {
    username: 'user_1234',
    password: 'secret123',
  });
});
