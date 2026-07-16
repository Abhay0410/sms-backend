// scripts/seedSuperAdmin.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import SuperAdmin from '../models/SuperAdmin.js';

dotenv.config();

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in the environment variables.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');
};

const seedSuperAdmin = async () => {
  try {
    await connectDB();

    console.log('🧹 Clearing existing Super Admins...');
    await SuperAdmin.deleteMany({});

    console.log('🌱 Seeding default Super Admin...');
    const hashedPassword = await bcrypt.hash('Superadmin@123', 10);
    
    const superAdmin = await SuperAdmin.create({
      name: 'Platform Owner',
      email: 'superadmin@zager.com',
      password: hashedPassword,
      role: 'superadmin',
      isActive: true
    });

    console.log('✅ Successfully seeded Super Admin:');
    console.log('══════════════════════════════════════');
    console.log(`👤 Name:     ${superAdmin.name}`);
    console.log(`✉️  Email:    ${superAdmin.email}`);
    console.log(`🔑 Password: Superadmin@123`);
    console.log('══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
