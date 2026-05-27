function normalizePagination(query) {
  const page = Math.max(1, Number.parseInt(query?.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query?.limit, 10) || 10));
  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function formatAdminUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username || '',
    phone: user.phone || '',
    nickname: user.nickname || '',
    contact: user.contact || '',
    role: user.role || 'user',
    status: user.status || 'active',
    cancellationRequestedAt: user.cancellationRequestedAt || null,
    cancelledAt: user.cancelledAt || null,
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null
  };
}

function normalizeOptionalString(value) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim();
  return normalized || null;
}

function fallbackDefaultNickname() {
  return `用户${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function registerAdminUserRoutes({
  app,
  authenticateToken,
  requireAuthUser,
  User,
  Op,
  hashPassword,
  normalizeUsername,
  isValidUsername,
  normalizeContact,
  assertContact,
  buildDefaultNickname,
}) {
  async function requireAdmin(req, res) {
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return null;
    if (authUser.role !== 'admin') {
      res.status(403).json({ error: '需要超级管理员权限' });
      return null;
    }
    return authUser;
  }

  app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAdmin(req, res);
      if (!authUser) return;

      const { page, limit, offset } = normalizePagination(req.query);
      const keyword = String(req.query.keyword || '').trim();
      const role = String(req.query.role || '').trim();
      const status = String(req.query.status || '').trim();
      const where = {};

      if (keyword) {
        where[Op.or] = [
          { username: { [Op.like]: `%${keyword}%` } },
          { nickname: { [Op.like]: `%${keyword}%` } },
          { contact: { [Op.like]: `%${keyword}%` } },
          { phone: { [Op.like]: `%${keyword}%` } },
        ];
      }
      if (role === 'admin' || role === 'user') {
        where.role = role;
      }
      if (['active', 'disabled', 'cancellation_pending', 'cancelled'].includes(status)) {
        where.status = status;
      }

      const result = await User.findAndCountAll({
        where,
        attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']],
        offset,
        limit
      });

      res.json({
        data: result.rows.map(formatAdminUser),
        total: result.count,
        page,
        limit
      });
    } catch (error) {
      console.error('Admin users list error:', error);
      res.status(500).json({ error: '获取用户列表失败' });
    }
  });

  app.post('/api/admin/users', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAdmin(req, res);
      if (!authUser) return;

      const username = normalizeUsername(req.body?.username);
      const password = String(req.body?.password || '');
      const phone = normalizeOptionalString(req.body?.phone);
      const contact = normalizeContact(req.body?.contact);
      const nickname = String(req.body?.nickname || '').trim();
      const role = String(req.body?.role || 'user').trim();
      const status = String(req.body?.status || 'active').trim();

      if (!username || !password) {
        res.status(400).json({ error: '用户名和密码不能为空' });
        return;
      }
      if (!isValidUsername(username)) {
        res.status(400).json({ error: '用户名仅支持字母、数字、下划线，长度 4-20 位' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: '密码至少 6 位' });
        return;
      }
      if (role !== 'admin' && role !== 'user') {
        res.status(400).json({ error: '角色参数无效' });
        return;
      }
      if (status !== 'active' && status !== 'disabled') {
        res.status(400).json({ error: '初始状态参数无效' });
        return;
      }

      if (contact) {
        const contactError = assertContact(contact);
        if (contactError) {
          res.status(400).json({ error: contactError });
          return;
        }
      }

      const existing = await User.findOne({ where: { username } });
      if (existing) {
        res.status(400).json({ error: '用户名已存在' });
        return;
      }

      if (phone) {
        const existingPhone = await User.findOne({ where: { phone } });
        if (existingPhone) {
          res.status(400).json({ error: '手机号已被其他用户占用' });
          return;
        }
      }

      const user = await User.create({
        username,
        password: hashPassword(password),
        phone,
        nickname: nickname || (typeof buildDefaultNickname === 'function' ? buildDefaultNickname() : fallbackDefaultNickname()),
        contact,
        role,
        status,
      });

      res.status(201).json({ data: formatAdminUser(user) });
    } catch (error) {
      console.error('Admin user create error:', error);
      res.status(500).json({ error: '添加用户失败' });
    }
  });

  app.get('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAdmin(req, res);
      if (!authUser) return;

      const user = await User.findByPk(req.params.id, {
        attributes: { exclude: ['password'] }
      });
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      res.json({ data: formatAdminUser(user) });
    } catch (error) {
      console.error('Admin user detail error:', error);
      res.status(500).json({ error: '获取用户详情失败' });
    }
  });

  app.patch('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAdmin(req, res);
      if (!authUser) return;

      const user = await User.findByPk(req.params.id);
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      const nextUsername = req.body.username !== undefined ? normalizeUsername(req.body.username) : undefined;
      const nextPhone = normalizeOptionalString(req.body.phone);
      const nextContact = req.body.contact !== undefined ? normalizeContact(req.body.contact) : undefined;
      const nextNickname = req.body.nickname !== undefined ? String(req.body.nickname || '').trim() : undefined;
      const nextRole = req.body.role !== undefined ? String(req.body.role || '').trim() : undefined;
      const nextStatus = req.body.status !== undefined ? String(req.body.status || '').trim() : undefined;

      if (nextUsername !== undefined) {
        if (!isValidUsername(nextUsername)) {
          res.status(400).json({ error: '用户名仅支持字母、数字、下划线，长度 4-20 位' });
          return;
        }
        const existing = await User.findOne({ where: { username: nextUsername } });
        if (existing && existing.id !== user.id) {
          res.status(400).json({ error: '用户名已存在' });
          return;
        }
        user.username = nextUsername;
      }

      if (nextNickname !== undefined) {
        user.nickname = nextNickname || null;
      }

      if (nextContact !== undefined) {
        const contactError = assertContact(nextContact);
        if (contactError) {
          res.status(400).json({ error: contactError });
          return;
        }
        user.contact = nextContact;
      }

      if (nextPhone !== undefined) {
        if (nextPhone) {
          const existingPhone = await User.findOne({ where: { phone: nextPhone } });
          if (existingPhone && existingPhone.id !== user.id) {
            res.status(400).json({ error: '手机号已被其他用户占用' });
            return;
          }
        }
        user.phone = nextPhone;
      }

      if (nextRole !== undefined) {
        if (nextRole !== 'admin' && nextRole !== 'user') {
          res.status(400).json({ error: '角色参数无效' });
          return;
        }
        if (user.id === authUser.id && nextRole !== 'admin') {
          res.status(400).json({ error: '不能取消自己的超级管理员权限' });
          return;
        }
        user.role = nextRole;
      }

      if (nextStatus !== undefined) {
        if (!['active', 'disabled', 'cancellation_pending', 'cancelled'].includes(nextStatus)) {
          res.status(400).json({ error: '状态参数无效' });
          return;
        }
        if (user.id === authUser.id && nextStatus !== 'active') {
          res.status(400).json({ error: '不能停用或注销自己的账号' });
          return;
        }
        if (nextStatus === 'cancellation_pending' && user.status !== 'cancellation_pending') {
          user.cancellationRequestedAt = user.cancellationRequestedAt || new Date();
          user.cancelledAt = null;
        }
        if (nextStatus === 'cancelled') {
          user.cancellationRequestedAt = user.cancellationRequestedAt || new Date();
          user.cancelledAt = new Date();
        }
        if (nextStatus === 'active' || nextStatus === 'disabled') {
          user.cancelledAt = null;
          if (user.status === 'cancellation_pending' || user.status === 'cancelled') {
            user.cancellationRequestedAt = null;
          }
        }
        user.status = nextStatus;
      }

      await user.save();
      res.json({ data: formatAdminUser(user) });
    } catch (error) {
      console.error('Admin user update error:', error);
      res.status(500).json({ error: '更新用户失败' });
    }
  });

  app.post('/api/admin/users/:id/reset-password', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAdmin(req, res);
      if (!authUser) return;

      const password = String(req.body.password || '');
      if (password.length < 6) {
        res.status(400).json({ error: '密码至少 6 位' });
        return;
      }

      const user = await User.findByPk(req.params.id);
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      user.password = hashPassword(password);
      await user.save();
      res.json({ success: true });
    } catch (error) {
      console.error('Admin user reset password error:', error);
      res.status(500).json({ error: '重置密码失败' });
    }
  });

  app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAdmin(req, res);
      if (!authUser) return;

      const user = await User.findByPk(req.params.id);
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }
      if (user.id === authUser.id) {
        res.status(400).json({ error: '不能删除自己的账号' });
        return;
      }

      await user.destroy();
      res.json({ success: true });
    } catch (error) {
      console.error('Admin user delete error:', error);
      res.status(500).json({ error: '删除用户失败' });
    }
  });
}

module.exports = {
  registerAdminUserRoutes,
  formatAdminUser,
};
