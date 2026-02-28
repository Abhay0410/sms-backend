// scripts/seedSchools.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import School from '../models/School.js';
import Admin from '../models/Admin.js';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');
};

const seedSchools = async () => {
  try {
    await connectDB();

    await School.deleteMany({});
    await Admin.deleteMany({}); // Clear existing admins

    const schoolsData = [
      { 
        schoolName: 'Green Valley School', 
        schoolCode: 'SCH001', 
        adminEmail: 'principal@greenvalley.com',
        phone: '9876543210',
        address: {
          street: 'Near Main Road',
          city: 'Bhubaneswar',
          state: 'Odisha',
          pincode: '751001',
          country: 'India',
        },
      },
      { 
        schoolName: 'Blue Ridge Academy', 
        schoolCode: 'SCH002', 
        adminEmail: 'admin@blueridge.com',
        phone: '9876543211',
        address: {
          street: 'Sector 5',
          city: 'Cuttack',
          state: 'Odisha',
          pincode: '753001',
          country: 'India',
        },
      },
      { 
        schoolName: 'Sunshine Public School', 
        schoolCode: 'SCH003', 
        adminEmail: 'principal@sunshine.com',
        phone: '9876543212',
        address: {
          street: 'Opposite Bus Stand',
          city: 'Bhubaneswar',
          state: 'Odisha',
          pincode: '751002',
          country: 'India',
        },
      },
      { 
        schoolName: 'Bulk Import High', 
        schoolCode: 'SCH004', 
        adminEmail: 'admin@bulktest.com',
        phone: '9988776655',
        address: {
          street: 'Tech Park Road',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500081',
          country: 'India',
        },
      },
    ];

    const schools = await School.insertMany(schoolsData);
    console.log('✅ 3 Demo Schools Created!');

    // Create Admins for these schools
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    
    const admins = schools.map(school => ({
      schoolId: school._id,
      name: `${school.schoolName} Principal`,
      email: school.adminEmail,
      password: hashedPassword,
      adminID: `ADM${school.schoolCode.slice(-3)}`, // SCH001 -> ADM001
      phone: school.phone,
      gender: 'Male',
      designation: 'Principal',
      department: 'Administration',
      isSuperAdmin: true,
      role: 'admin',
      isActive: true
    }));

    await Admin.insertMany(admins);
    console.log('✅ School Admins Created!');

    console.log('\n📋 LOGIN CREDENTIALS:');
    console.table(admins.map(a => ({
      School: schools.find(s => s._id === a.schoolId).schoolName,
      Email: a.email,
      AdminID: a.adminID,
      Password: 'Admin@123'
    })));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedSchools();