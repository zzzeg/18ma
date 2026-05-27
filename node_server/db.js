const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');

const dbDialect = (process.env.DB_DIALECT || 'mysql').toLowerCase();

function createSequelize() {
  if (dbDialect === 'mysql') {
    return new Sequelize(
      process.env.DB_NAME || '8ma_app',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'mysql',
        port: Number(process.env.DB_PORT || 3306),
        logging: false,
        charset: 'utf8mb4',
        define: {
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci'
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 60000,
          idle: 10000
        },
        dialectOptions: {
          charset: 'utf8mb4',
          connectTimeout: 60000
        }
      }
    );
  }

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return new Sequelize({
    dialect: 'sqlite',
    storage: path.join(dataDir, 'app.sqlite'),
    logging: false
  });
}

const sequelize = createSequelize();
const queryInterface = sequelize.getQueryInterface();

// User Model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true // Allow null for users who only use SMS login
  },
  nickname: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contact: {
    type: DataTypes.STRING,
    allowNull: true
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user'
  },
  lastLogin: {
    type: DataTypes.DATE
  }
});

// Share Model
const Share = sequelize.define('Share', {
  shareCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  userPhone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.99
  },
  filePath: {
    type: DataTypes.STRING
  },
  fileSize: {
    type: DataTypes.INTEGER
  },
  fileType: {
    type: DataTypes.STRING
  },
  originalName: {
    type: DataTypes.STRING
  },
  downloads: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  earnings: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  uploadTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  resourceType: {
    type: DataTypes.STRING,
    defaultValue: 'file'
  },
  cloudUrl: {
    type: DataTypes.STRING
  },
  extractionCode: {
    type: DataTypes.STRING
  },
  url: {
    type: DataTypes.STRING
  },
  autoRedirect: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  content: {
    type: DataTypes.TEXT
  },
  note: {
    type: DataTypes.TEXT
  }
});

// Verification Code Model
const VerificationCode = sequelize.define('VerificationCode', {
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
});

// Payment Record Model
const PaymentRecord = sequelize.define('PaymentRecord', {
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '订单号'
  },
  shareCode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '分享码'
  },
  userPhone: {
    type: DataTypes.STRING,
    comment: '用户手机号（登录用户才有）'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '支付金额'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    defaultValue: 'alipay',
    comment: '支付方式（wechat/alipay）'
  },
  paymentTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '支付时间'
  },
  ipAddress: {
    type: DataTypes.STRING,
    comment: 'IP地址'
  },
  expiresAt: {
    type: DataTypes.DATE,
    comment: '订单有效期（24小时）'
  },
  legacyType: {
    type: DataTypes.STRING,
    defaultValue: 'payment-history',
    comment: '历史支付数据标识'
  },
  legacyMarkedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '历史支付标记时间'
  }
});

const RedeemCode = sequelize.define('RedeemCode', {
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  resourceId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ownerUserId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  durationCode: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '1h'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'unused'
  },
  usedByUserId: {
    type: DataTypes.INTEGER
  },
  usedContact: {
    type: DataTypes.STRING(64)
  },
  usedAt: {
    type: DataTypes.DATE
  },
  disabledAt: {
    type: DataTypes.DATE
  },
  createdByUserId: {
    type: DataTypes.INTEGER
  },
  sourceType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'manual'
  },
  batchNo: {
    type: DataTypes.STRING
  },
  remark: {
    type: DataTypes.STRING
  }
});

const RedeemRecord = sequelize.define('RedeemRecord', {
  codeId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  resourceId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ownerUserId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  redeemedByUserId: {
    type: DataTypes.INTEGER
  },
  contact: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  redeemedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  accessStartAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  accessExpireAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'active'
  }
});

// 提现账户：本地环境先保存必要字段，后续可接入实名/打款通道
const WithdrawalAccount = sequelize.define('WithdrawalAccount', {
  userPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '用户手机号'
  },
  type: {
    type: DataTypes.ENUM('alipay', 'bank'),
    allowNull: false,
    defaultValue: 'alipay',
    comment: '账户类型'
  },
  realName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '真实姓名'
  },
  accountNo: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '收款账号/银行卡号'
  },
  bankName: {
    type: DataTypes.STRING,
    comment: '银行名称'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
    comment: 'active/disabled'
  }
});

// 提现申请：本地环境提交后默认进入审核中
const Withdrawal = sequelize.define('Withdrawal', {
  withdrawalNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '提现流水号'
  },
  userPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '用户手机号'
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '提现账户 ID'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '提现金额'
  },
  fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '手续费'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    comment: 'pending/approved/paid/rejected'
  },
  remark: {
    type: DataTypes.STRING,
    comment: '备注'
  }
});

const MessageThread = sequelize.define('MessageThread', {
  userPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '所属用户手机号'
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'support',
    comment: 'support/system/guestbook'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '会话标题'
  },
  description: {
    type: DataTypes.STRING,
    comment: '会话预览'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'open',
    comment: 'open/pending/waiting_admin/waiting_user/expired/closed'
  },
  priority: {
    type: DataTypes.STRING,
    defaultValue: 'normal',
    comment: 'low/normal/high'
  },
  unreadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

const MessageEntry = sequelize.define('MessageEntry', {
  threadId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  senderRole: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user',
    comment: 'user/admin/system'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  messageType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'chat',
    comment: 'chat/note/notification'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Associations
Share.hasMany(PaymentRecord, { foreignKey: 'shareCode', sourceKey: 'shareCode', constraints: false });
PaymentRecord.belongsTo(Share, { foreignKey: 'shareCode', targetKey: 'shareCode', constraints: false });
User.hasMany(WithdrawalAccount, { foreignKey: 'userPhone', sourceKey: 'phone', constraints: false });
WithdrawalAccount.belongsTo(User, { foreignKey: 'userPhone', targetKey: 'phone', constraints: false });
WithdrawalAccount.hasMany(Withdrawal, { foreignKey: 'accountId', sourceKey: 'id', constraints: false });
Withdrawal.belongsTo(WithdrawalAccount, { foreignKey: 'accountId', targetKey: 'id', constraints: false });
User.hasMany(MessageThread, { foreignKey: 'userPhone', sourceKey: 'phone', constraints: false });
MessageThread.belongsTo(User, { foreignKey: 'userPhone', targetKey: 'phone', constraints: false });
MessageThread.hasMany(MessageEntry, { foreignKey: 'threadId', sourceKey: 'id', constraints: false, as: 'entries' });
MessageEntry.belongsTo(MessageThread, { foreignKey: 'threadId', targetKey: 'id', constraints: false, as: 'thread' });
Share.hasMany(RedeemCode, { foreignKey: 'resourceId', sourceKey: 'id', constraints: false });
RedeemCode.belongsTo(Share, { foreignKey: 'resourceId', targetKey: 'id', constraints: false });
User.hasMany(RedeemCode, { foreignKey: 'ownerUserId', sourceKey: 'id', constraints: false, as: 'ownedRedeemCodes' });
RedeemCode.belongsTo(User, { foreignKey: 'ownerUserId', targetKey: 'id', constraints: false, as: 'owner' });
User.hasMany(RedeemRecord, { foreignKey: 'ownerUserId', sourceKey: 'id', constraints: false, as: 'ownedRedeemRecords' });
RedeemRecord.belongsTo(User, { foreignKey: 'ownerUserId', targetKey: 'id', constraints: false, as: 'owner' });
RedeemCode.hasOne(RedeemRecord, { foreignKey: 'codeId', sourceKey: 'id', constraints: false, as: 'record' });
RedeemRecord.belongsTo(RedeemCode, { foreignKey: 'codeId', targetKey: 'id', constraints: false, as: 'code' });
Share.hasMany(RedeemRecord, { foreignKey: 'resourceId', sourceKey: 'id', constraints: false });
RedeemRecord.belongsTo(Share, { foreignKey: 'resourceId', targetKey: 'id', constraints: false });

async function ensureColumn(tableName, columnName, definition) {
  const description = await queryInterface.describeTable(tableName);
  if (!description[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function ensureUniqueIndex(tableName, indexName, fields) {
  const existingIndexes = await queryInterface.showIndex(tableName);
  if (existingIndexes.some((index) => index.name === indexName)) {
    return;
  }

  await queryInterface.addIndex(tableName, fields, {
    unique: true,
    name: indexName
  });
}

async function ensureNullableColumn(tableName, columnName, definition) {
  const description = await queryInterface.describeTable(tableName);
  if (!description[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
    return;
  }

  if (description[columnName].allowNull === false) {
    await queryInterface.changeColumn(tableName, columnName, {
      ...definition,
      allowNull: true
    });
  }
}

async function ensureSchemaUpgrades() {
  const userTable = User.getTableName();
  const paymentRecordTable = PaymentRecord.getTableName();

  await ensureColumn(userTable, 'username', {
    type: DataTypes.STRING,
    allowNull: true
  });
  await ensureUniqueIndex(userTable, 'users_username_unique', ['username']);

  await ensureNullableColumn(userTable, 'phone', {
    type: DataTypes.STRING,
    allowNull: true
  });

  await ensureColumn(userTable, 'role', {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user'
  });

  await ensureColumn(paymentRecordTable, 'legacyType', {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'payment-history'
  });

  await ensureColumn(paymentRecordTable, 'legacyMarkedAt', {
    type: DataTypes.DATE,
    allowNull: true
  });
}

async function ensureDefaultData() {
  await User.update(
    { role: 'user' },
    {
      where: {
        [Sequelize.Op.or]: [
          { role: null },
          { role: '' }
        ]
      }
    }
  );

  const adminCount = await User.count({ where: { role: 'admin' } });
  if (adminCount === 0) {
    const firstUser = await User.findOne({
      where: {
        username: {
          [Sequelize.Op.ne]: null
        }
      },
      order: [['createdAt', 'ASC']]
    });
    if (firstUser) {
      firstUser.role = 'admin';
      await firstUser.save();
    }
  }

  await PaymentRecord.update(
    { legacyType: 'payment-history', legacyMarkedAt: new Date() },
    { where: { legacyType: null } }
  );
}

// Initialize database with retry logic
async function initDB(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to connect to ${dbDialect} database (Attempt ${i + 1}/${retries})...`);
      await sequelize.authenticate();
      console.log(`${dbDialect} database connection has been established successfully.`);

      await sequelize.sync();
      await ensureSchemaUpgrades();
      await ensureDefaultData();
      console.log('Database synchronized successfully.');
      return;
    } catch (error) {
      console.error(`Database connection failed (Attempt ${i + 1}):`, error.message);
      if (dbDialect === 'mysql') {
          console.error('Current MySQL target:', {
          host: process.env.DB_HOST || '127.0.0.1',
          port: Number(process.env.DB_PORT || 3306),
          database: process.env.DB_NAME || '8ma_app',
          user: process.env.DB_USER || 'root'
        });
      }
      if (i === retries - 1) {
        console.error('Max retries reached. Exiting.');
        process.exit(1);
      }
      // Wait 5 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

module.exports = { 
  sequelize, 
  User, 
  Share, 
  VerificationCode,
  PaymentRecord,
  RedeemCode,
  RedeemRecord,
  WithdrawalAccount,
  Withdrawal,
  MessageThread,
  MessageEntry,
  initDB 
};
