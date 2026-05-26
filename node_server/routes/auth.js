function registerAuthRoutes({
  app,
  authenticateToken,
  User,
  VerificationCode,
  Op,
  resolveAccountValue,
  isValidAccount,
  ensureTurnstile,
  getSendCodeCooldownRemaining,
  generateCode,
  setSendCodeCooldown,
  hashPassword,
  buildDefaultNickname,
  signUserToken,
  verifyPassword,
  upgradePasswordHashIfNeeded,
  normalizeContact,
  assertContact,
}) {
  async function consumeVerificationCode(account, code) {
    const validCode = await VerificationCode.findOne({
      where: { phone: account, code, expiresAt: { [Op.gt]: new Date() } },
      order: [['createdAt', 'DESC']]
    });

    if (!validCode) {
      return null;
    }

    const deletedCount = await VerificationCode.destroy({
      where: { id: validCode.id }
    });

    return deletedCount ? validCode : null;
  }

  app.post('/api/auth/send-code', async (req, res) => {
    try {
      const account = resolveAccountValue(req.body);
      if (!account) return res.status(400).json({ error: 'Account is required' });
      if (!isValidAccount(account)) {
        return res.status(400).json({ error: 'Invalid email or phone number' });
      }
      if (!(await ensureTurnstile(req, res, '发送验证码'))) return;

      const cooldownRemaining = getSendCodeCooldownRemaining(account, req);
      if (cooldownRemaining > 0) {
        return res.status(429).json({
          error: `请求过于频繁，请 ${Math.ceil(cooldownRemaining / 1000)} 秒后再试`,
          retryAfter: Math.ceil(cooldownRemaining / 1000)
        });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const isProduction = String(process.env.NODE_ENV || '').trim() === 'production';

      await VerificationCode.create({ phone: account, code, expiresAt });
      setSendCodeCooldown(account, req);
      res.json({
        success: true,
        message: 'Verification code sent',
        ...(isProduction ? {} : { debugCode: code })
      });
    } catch (error) {
      console.error('Send code error:', error);
      res.status(500).json({ error: 'Failed to send verification code' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const account = resolveAccountValue(req.body);
      const { code, password } = req.body;

      if (!account || !code || !password) {
        return res.status(400).json({ error: 'Account, code and password are required' });
      }
      if (!isValidAccount(account)) {
        return res.status(400).json({ error: 'Invalid email or phone number' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      if (!(await ensureTurnstile(req, res, '注册'))) return;

      let user = await User.findOne({ where: { phone: account } });
      if (user) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const validCode = await consumeVerificationCode(account, code);

      if (!validCode) {
        return res.status(400).json({ error: 'Invalid or expired verification code' });
      }

      user = await User.create({
        phone: account,
        password: hashPassword(password),
        nickname: buildDefaultNickname(account),
        role: 'user'
      });

      const token = signUserToken(user);
      res.json({ success: true, token, phone: user.phone, nickname: user.nickname, role: user.role });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const account = resolveAccountValue(req.body);
      const { code } = req.body;

      if (!account || !code) {
        return res.status(400).json({ error: 'Account and code are required' });
      }
      if (!isValidAccount(account)) {
        return res.status(400).json({ error: 'Invalid email or phone number' });
      }
      if (!(await ensureTurnstile(req, res, '验证码登录'))) return;

      const validCode = await consumeVerificationCode(account, code);

      if (!validCode) {
        return res.status(400).json({ error: 'Invalid or expired verification code' });
      }

      let user = await User.findOne({ where: { phone: account } });
      if (!user) {
        user = await User.create({
          phone: account,
          nickname: buildDefaultNickname(account),
          role: 'user'
        });
      }

      user.lastLogin = new Date();
      await user.save();

      const token = signUserToken(user);
      res.json({ success: true, token, phone: user.phone, nickname: user.nickname, role: user.role });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/login-password', async (req, res) => {
    try {
      const account = resolveAccountValue(req.body);
      const { password } = req.body;

      if (!account || !password) {
        return res.status(400).json({ error: 'Account and password are required' });
      }
      if (!isValidAccount(account)) {
        return res.status(400).json({ error: 'Invalid email or phone number' });
      }
      if (!(await ensureTurnstile(req, res, '登录'))) return;

      const user = await User.findOne({ where: { phone: account } });
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      if (!user.password) {
        return res.status(400).json({ error: 'Password not set for this user' });
      }

      if (!verifyPassword(password, user.password)) {
        return res.status(400).json({ error: 'Incorrect password' });
      }

      user.lastLogin = new Date();
      await upgradePasswordHashIfNeeded(user, password);
      await user.save();

      const token = signUserToken(user);
      res.json({ success: true, token, phone: user.phone, nickname: user.nickname, role: user.role });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ success: true, phone: req.user.phone, role: req.user.role || 'user' });
  });

  app.post('/api/auth/update-password', authenticateToken, async (req, res) => {
    try {
      const { newPassword } = req.body;
      const userPhone = req.user.phone;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const user = await User.findOne({ where: { phone: userPhone } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.password = hashPassword(newPassword);
      await user.save();

      console.log('[UpdatePassword] Password updated for user:', userPhone);
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
      const user = await User.findOne({ where: { phone: req.user.phone } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        data: {
          phone: user.phone,
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
      const user = await User.findOne({ where: { phone: req.user.phone } });

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

      console.log('[UpdateProfile] Profile updated for user:', req.user.phone);
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          phone: user.phone,
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
