// scripts/seedSchools.js
import mongoose from 'mongoose';
import School from '../models/School.js';
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

    const schools = [
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
    ];

    await School.insertMany(schools);
    console.log('✅ 3 Demo Schools Created!');
    console.log('📋 School Codes:', schools.map(s => s.schoolCode));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedSchools();