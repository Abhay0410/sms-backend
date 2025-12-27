// scripts/seedAdmin.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedAdmin = async () => {
  try {
    await connectDB();

    // Clear existing admins
    await Admin.deleteMany({});
    console.log('🗑️ Cleared existing admins');

    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    const admins = [
      {
        name: 'Super Admin',
        email: 'admin@school.com',
        password: hashedPassword,
        adminID: 'ADM0001',  // ✅ Changed to 4 digits
        phone: '9876543210',
        gender: 'Male',
        designation: 'Principal',
        department: 'Administration',
        isSuperAdmin: true,
        permissions: [
          { module: 'students', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'teachers', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'classes', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'fees', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'results', actions: ['create', 'read', 'update', 'delete', 'approve', 'publish'] },
          { module: 'attendance', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'announcements', actions: ['create', 'read', 'update', 'delete'] },
        ],
        role: 'admin',
        isActive: true,
      },
      {
        name: 'Vice Principal',
        email: 'viceadmin@school.com',
        password: hashedPassword,
        adminID: 'ADM0002',  // ✅ Changed to 4 digits
        phone: '9876543211',
        gender: 'Female',
        designation: 'Vice Principal',
        department: 'Administration',
        isSuperAdmin: false,
        permissions: [
          { module: 'students', actions: ['read', 'update'] },
          { module: 'teachers', actions: ['read'] },
          { module: 'results', actions: ['read', 'approve'] },
        ],
        role: 'admin',
        isActive: true,
      }
    ];

    await Admin.insertMany(admins);

    console.log('✅ Admin seeded successfully');
    console.log('\n📋 Login Credentials:');
    console.log('══════════════════════════════════════');
    console.log('🔐 Super Admin:');
    console.log('   Admin ID: ADM0001');
    console.log('   Email: admin@school.com');
    console.log('   Password: Admin@123');
    console.log('══════════════════════════════════════');
    console.log('🔐 Vice Principal:');
    console.log('   Admin ID: ADM0002');
    console.log('   Email: viceadmin@school.com');
    console.log('   Password: Admin@123');
    console.log('══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
