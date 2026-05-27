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
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null
  };
}

function registerAdminUserRoutes({
  app,
  authenticateToken,
  requireAuthUser,
  User,
  Op,
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
}

module.exports = {
  registerAdminUserRoutes,
  formatAdminUser,
};
