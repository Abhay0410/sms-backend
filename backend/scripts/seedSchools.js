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

    // COMMENTED OUT TO PREVENT DELETING OLD SCHOOLS
    // await School.deleteMany({});
    // await Admin.deleteMany({}); 

    const schoolsData = [
      { 
        schoolName: 'Delhi Public School', 
        schoolCode: 'SCH005', 
        adminEmail: 'principal@dps.com',
        phone: '9988776655',
        address: {
          street: 'Main Road',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001',
          country: 'India',
        },
      },
    ];

    const schools = await School.insertMany(schoolsData);
    console.log('✅ New School Created!');

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