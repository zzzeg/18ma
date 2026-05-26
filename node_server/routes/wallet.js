function registerWalletRoutes({
  app,
  authenticateToken,
  PaymentRecord,
  Share,
  WithdrawalAccount,
  Withdrawal,
  parsePaginationParams,
  buildPaginatedResult,
  requireAuthUser,
  toNumber,
  mapWithdrawalStatus,
  accountDisplayName,
  maskAccount,
  generateWithdrawalNo,
  Op,
  mockPaymentLegacyType,
}) {
  app.get('/api/wallet/summary', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;
      const userPhone = authUser.phone;

      const sellerPayments = await PaymentRecord.findAll({
        where: {
          legacyType: {
            [Op.ne]: mockPaymentLegacyType
          }
        },
        include: [
          {
            model: Share,
            attributes: ['shareCode'],
            where: { userPhone }
          }
        ]
      });
      const withdrawals = await Withdrawal.findAll({ where: { userPhone } });

      const totalEarnings = sellerPayments.reduce((sum, row) => sum + toNumber(row.amount), 0);
      const frozenAmount = withdrawals
        .filter((row) => ['pending', 'approved'].includes(row.status))
        .reduce((sum, row) => sum + toNumber(row.amount), 0);
      const withdrawnAmount = withdrawals
        .filter((row) => row.status === 'paid')
        .reduce((sum, row) => sum + toNumber(row.amount), 0);
      const paidWithdrawalCount = withdrawals.filter((row) => row.status === 'paid').length;
      const availableBalance = Math.max(totalEarnings - frozenAmount - withdrawnAmount, 0);

      res.json({
        success: true,
        data: {
          availableBalance,
          frozenAmount,
          withdrawnAmount,
          totalEarnings,
          pendingWithdrawalAmount: frozenAmount,
          withdrawalCount: withdrawals.length,
          paidWithdrawalCount
        }
      });
    } catch (error) {
      console.error('Get wallet summary error:', error);
      res.status(500).json({ error: '获取钱包概览失败' });
    }
  });

  app.get('/api/withdrawal-accounts', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;
      const rows = await WithdrawalAccount.findAll({
        where: { userPhone: authUser.phone },
        order: [['createdAt', 'DESC']]
      });
      const data = rows.map((row) => ({
        id: row.id,
        type: row.type,
        realName: row.realName,
        accountNo: row.accountNo,
        maskedAccount: maskAccount(row.accountNo),
        bankName: row.bankName || '',
        status: row.status,
        displayName: accountDisplayName(row),
        createdAt: row.createdAt
      }));
      res.json({ success: true, data, total: data.length });
    } catch (error) {
      console.error('Get withdrawal accounts error:', error);
      res.status(500).json({ error: '获取提现账户失败' });
    }
  });

  app.post('/api/withdrawal-accounts', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;
      const { type = 'alipay', realName, accountNo, bankName } = req.body;
      if (!['alipay', 'bank'].includes(type)) {
        return res.status(400).json({ error: '提现账户类型不正确' });
      }
      if (!realName || !accountNo) {
        return res.status(400).json({ error: '请填写真实姓名和收款账号' });
      }
      if (type === 'bank' && !bankName) {
        return res.status(400).json({ error: '银行卡提现需填写银行名称' });
      }

      const count = await WithdrawalAccount.count({ where: { userPhone: authUser.phone, status: 'active' } });
      if (count >= 3) {
        return res.status(400).json({ error: '每位用户最多绑定 3 个提现账户' });
      }

      const account = await WithdrawalAccount.create({
        userPhone: authUser.phone,
        type,
        realName,
        accountNo,
        bankName: type === 'bank' ? bankName : ''
      });

      res.json({
        success: true,
        data: {
          id: account.id,
          type: account.type,
          realName: account.realName,
          accountNo: account.accountNo,
          maskedAccount: maskAccount(account.accountNo),
          bankName: account.bankName || '',
          status: account.status,
          displayName: accountDisplayName(account)
        }
      });
    } catch (error) {
      console.error('Create withdrawal account error:', error);
      res.status(500).json({ error: '新增提现账户失败' });
    }
  });

  app.delete('/api/withdrawal-accounts/:id', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;
      const account = await WithdrawalAccount.findOne({ where: { id: req.params.id, userPhone: authUser.phone } });
      if (!account) return res.status(404).json({ error: '提现账户不存在' });
      account.status = 'disabled';
      await account.save();
      res.json({ success: true, message: '提现账户已停用' });
    } catch (error) {
      console.error('Delete withdrawal account error:', error);
      res.status(500).json({ error: '删除提现账户失败' });
    }
  });

  app.get('/api/withdrawals', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;
      const { page, limit } = parsePaginationParams(req.query, 10, 200);
      const rows = await Withdrawal.findAll({
        where: { userPhone: authUser.phone },
        include: [{ model: WithdrawalAccount }],
        order: [['createdAt', 'DESC']]
      });
      const data = rows.map((row) => ({
        id: row.withdrawalNo,
        withdrawalNo: row.withdrawalNo,
        time: row.createdAt,
        amount: toNumber(row.amount),
        fee: toNumber(row.fee),
        status: mapWithdrawalStatus(row.status),
        rawStatus: row.status,
        account: accountDisplayName(row.WithdrawalAccount),
        accountId: row.accountId,
        remark: row.remark || ''
      }));
      const paginated = buildPaginatedResult(data, page, limit);
      res.json({ success: true, ...paginated });
    } catch (error) {
      console.error('Get withdrawals error:', error);
      res.status(500).json({ error: '获取提现记录失败' });
    }
  });

  app.post('/api/withdrawals', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;
      const { accountId, amount } = req.body;
      const value = toNumber(amount);
      if (!accountId) return res.status(400).json({ error: '请选择提现账户' });
      if (value < 100) return res.status(400).json({ error: '单笔提现最低金额为 ¥100.00' });
      if (value > 50000) return res.status(400).json({ error: '单笔提现最高金额为 ¥50,000.00' });

      const account = await WithdrawalAccount.findOne({
        where: { id: accountId, userPhone: authUser.phone, status: 'active' }
      });
      if (!account) return res.status(404).json({ error: '提现账户不存在或已停用' });

      const sellerPayments = await PaymentRecord.findAll({
        where: {
          legacyType: {
            [Op.ne]: mockPaymentLegacyType
          }
        },
        include: [{ model: Share, attributes: ['shareCode'], where: { userPhone: authUser.phone } }]
      });
      const withdrawals = await Withdrawal.findAll({ where: { userPhone: authUser.phone } });
      const totalEarnings = sellerPayments.reduce((sum, row) => sum + toNumber(row.amount), 0);
      const occupied = withdrawals
        .filter((row) => ['pending', 'approved', 'paid'].includes(row.status))
        .reduce((sum, row) => sum + toNumber(row.amount), 0);
      const availableBalance = Math.max(totalEarnings - occupied, 0);
      if (value > availableBalance) {
        return res.status(400).json({ error: '可提现余额不足' });
      }

      const withdrawal = await Withdrawal.create({
        withdrawalNo: generateWithdrawalNo(),
        userPhone: authUser.phone,
        accountId: account.id,
        amount: value,
        fee: Number((value * 0.001).toFixed(2)),
        status: 'pending',
        remark: '本地环境提交，待人工审核'
      });

      res.json({
        success: true,
        message: '提现申请已提交',
        data: {
          id: withdrawal.withdrawalNo,
          withdrawalNo: withdrawal.withdrawalNo,
          time: withdrawal.createdAt,
          amount: toNumber(withdrawal.amount),
          fee: toNumber(withdrawal.fee),
          status: mapWithdrawalStatus(withdrawal.status),
          account: accountDisplayName(account)
        }
      });
    } catch (error) {
      console.error('Create withdrawal error:', error);
      res.status(500).json({ error: '提交提现申请失败' });
    }
  });
}

module.exports = {
  registerWalletRoutes,
};
