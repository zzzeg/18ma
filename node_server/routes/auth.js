function registerAuthRoutes({
  app,
  authenticateToken,
  User,
  normalizeUsername,
  isValidUsername,
  normalizeRegisterPayload,
  ensureTurnstile,
  hashPassword,
  buildDefaultNickname,
  signUserToken,
  verifyPassword,
  upgradePasswordHashIfNeeded,
  normalizeContact,
  assertContact,
}) {
  app.post('/api/auth/send-code', async (req, res) => {
    return res.status(410).json({
      error: '邮箱验证码注册已停用，请改用用户名密码注册',
      code: 'AUTH_SEND_CODE_DISABLED'
    });
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password } = normalizeRegisterPayload(req.body);

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      if (!isValidUsername(username)) {
        return res.status(400).json({ error: '用户名仅支持字母、数字、下划线，长度 4-20 位' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      if (!(await ensureTurnstile(req, res, '注册'))) return;

      let user = await User.findOne({ where: { username } });
      if (user) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      user = await User.create({
        username,
        password: hashPassword(password),
        nickname: buildDefaultNickname(username),
        role: 'user'
      });

      const token = signUserToken(user);
      res.json({ success: true, token, username: user.username, nickname: user.nickname, role: user.role });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    return res.status(410).json({
      error: '验证码登录已停用，请改用用户名密码登录',
      code: 'AUTH_CODE_LOGIN_DISABLED'
    });
  });

  app.post('/api/auth/login-password', async (req, res) => {
    try {
      const username = normalizeUsername(req.body?.username);
      const { password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      if (!isValidUsername(username)) {
        return res.status(400).json({ error: '用户名仅支持字母、数字、下划线，长度 4-20 位' });
      }
      if (!(await ensureTurnstile(req, res, '登录'))) return;

      const user = await User.findOne({ where: { username } });
      if (!user) {
        return res.status(400).json({ error: '用户名或密码错误' });
      }

      if (!user.password) {
        return res.status(400).json({ error: '用户名或密码错误' });
      }

      if (!verifyPassword(password, user.password)) {
        return res.status(400).json({ error: '用户名或密码错误' });
      }

      user.lastLogin = new Date();
      await upgradePasswordHashIfNeeded(user, password);
      await user.save();

      const token = signUserToken(user);
      res.json({ success: true, token, username: user.username, nickname: user.nickname, role: user.role });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
      success: true,
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role || 'user'
    });
  });

  app.post('/api/auth/update-password', authenticateToken, async (req, res) => {
    try {
      const { newPassword } = req.body;
      const userId = req.user.userId;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.password = hashPassword(newPassword);
      await user.save();

      console.log('[UpdatePassword] Password updated for user:', user.username);
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
      const user = await User.findByPk(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        data: {
          username: user.username,
          nickname: user.nickname || '',
          contact: user.contact || '',
          role: user.role || 'user'
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
      const { nickname, contact } = req.body;
      const user = await User.findByPk(req.user.userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (nickname !== undefined) user.nickname = nickname;
      if (contact !== undefined) {
        const normalized = normalizeContact(contact);
        const contactError = assertContact(normalized);
        if (contactError) {
          return res.status(400).json({ error: contactError });
        }
        user.contact = normalized;
      }

      await user.save();

      console.log('[UpdateProfile] Profile updated for user:', user.username);
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          username: user.username,
          nickname: user.nickname,
          contact: user.contact,
          role: user.role || 'user'
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });
}

module.exports = {
  registerAuthRoutes,
};
