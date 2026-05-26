function normalizeUsername(value) {
  return String(value || '').trim();
}

function isValidUsername(value) {
  return /^[A-Za-z0-9_]{4,20}$/.test(normalizeUsername(value));
}

function randomNicknameSuffix(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';

  for (let index = 0; index < length; index += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

function buildDefaultNickname() {
  return `用户${randomNicknameSuffix(6)}`;
}

function signUserTokenPayload(user) {
  return {
    userId: user.id,
    username: user.username,
    role: user.role || 'user',
  };
}

function normalizeRegisterPayload(payload) {
  return {
    username: normalizeUsername(payload?.username),
    password: String(payload?.password || ''),
  };
}

module.exports = {
  normalizeUsername,
  isValidUsername,
  buildDefaultNickname,
  signUserTokenPayload,
  normalizeRegisterPayload,
};
