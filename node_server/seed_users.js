const { sequelize, User } = require('./db');

async function seedUsers() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connection established.');

    const users = [
      { phone: '13800138000' },
      { phone: '13900139000' },
      { phone: '15000150000' },
      { phone: '18000180000' },
      { phone: '13600136000' }
    ];

    console.log('Seeding users...');
    
    for (const userData of users) {
      try {
        const [user, created] = await User.findOrCreate({
          where: { phone: userData.phone },
          defaults: { lastLogin: new Date() }
        });
        
        if (created) {
          console.log(`Created user: ${user.phone}`);
        } else {
          console.log(`User already exists: ${user.phone}`);
        }
      } catch (err) {
        console.error(`Failed to create user ${userData.phone}:`, err.message);
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
