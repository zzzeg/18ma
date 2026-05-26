const { sequelize, User } = require('./db');

async function seedUsers() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connection established.');

    const users = [
      { username: 'admin_seed_01', nickname: '用户A1B2C3' },
      { username: 'seller_seed_01', nickname: '用户D4E5F6' }
    ];

    console.log('Seeding users...');
    
    for (const userData of users) {
      try {
        const [user, created] = await User.findOrCreate({
          where: { username: userData.username },
          defaults: { nickname: userData.nickname, lastLogin: new Date() }
        });
        
        if (created) {
          console.log(`Created user: ${user.username}`);
        } else {
          console.log(`User already exists: ${user.username}`);
        }
      } catch (err) {
        console.error(`Failed to create user ${userData.username}:`, err.message);
      }
    }

    console.log('Seeding completed.');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

seedUsers();
