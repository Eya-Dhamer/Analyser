require('./config/loadEnv');
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/network-analyzer';

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
    if (existingAdmin) {
      console.log('Admin user found, updating password...');
      existingAdmin.password = 'Test@123456';
      existingAdmin.emailVerified = true;
      existingAdmin.markModified('password');
      await existingAdmin.save();
      console.log('✅ Password updated successfully');
      console.log('Email: admin@gmail.com');
      console.log('Password: Test@123456');
      process.exit(0);
    }

    // Create admin user
    const admin = new User({
      name: 'Admin',
      email: 'admin@gmail.com',
      password: 'Test@123456',
      role: 'admin',
      emailVerified: true,
    });

    await admin.save();
    console.log('✅ Admin user created successfully');
    console.log('Email: admin@gmail.com');
    console.log('Password: Test@123456');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
};

seedDatabase();
