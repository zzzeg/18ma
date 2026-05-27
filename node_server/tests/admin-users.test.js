const test = require('node:test');
const assert = require('node:assert/strict');
const { formatAdminUser } = require('../routes/admin-users');

test('formats admin user detail without password hash', () => {
  const user = {
    id: 1,
    username: 'admin_user',
    phone: null,
    password: 'scrypt$secret',
    nickname: '管理员',
    contact: 'admin@example.test',
    role: 'admin',
    lastLogin: new Date('2026-05-27T00:00:00Z'),
    createdAt: new Date('2026-05-26T00:00:00Z'),
    updatedAt: new Date('2026-05-27T01:00:00Z'),
  };

  const result = formatAdminUser(user);

  assert.equal(result.username, 'admin_user');
  assert.equal(result.role, 'admin');
  assert.equal(Object.hasOwn(result, 'password'), false);
});
