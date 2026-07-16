// scripts/seedDefaultPlans.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

dotenv.config();

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in the environment variables.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');
};

const defaultPlans = [
  {
    name: 'STARTER',
    monthlyPrice: 49,
    yearlyPrice: 499,
    limits: {
      maxStudents: 150,
      maxStaff: 15,
      maxStorageMB: 2048 // 2 GB
    },
    features: [] // Only core features
  },
  {
    name: 'PROFESSIONAL',
    monthlyPrice: 149,
    yearlyPrice: 1499,
    limits: {
      maxStudents: 1000,
      maxStaff: 75,
      maxStorageMB: 10240 // 10 GB
    },
    features: ['TRANSPORT', 'INVENTORY', 'LIBRARY', 'HR', 'EXPENSE']
  },
  {
    name: 'ENTERPRISE',
    monthlyPrice: 399,
    yearlyPrice: 3999,
    limits: {
      maxStudents: -1, // Unlimited
      maxStaff: -1,    // Unlimited
      maxStorageMB: -1 // Unlimited
    },
    features: ['TRANSPORT', 'INVENTORY', 'LIBRARY', 'HR', 'EXPENSE', 'PAYROLL']
  }
];

const seedPlans = async () => {
  try {
    await connectDB();

    console.log('🧹 Clearing existing plans...');
    await SubscriptionPlan.deleteMany({});

    console.log('🌱 Seeding new subscription plans...');
    const createdPlans = await SubscriptionPlan.insertMany(defaultPlans);
    console.log('✅ Successfully seeded subscription plans:');
    console.table(createdPlans.map(p => ({
      Name: p.name,
      Monthly: `$${p.monthlyPrice}`,
      Yearly: `$${p.yearlyPrice}`,
      MaxStudents: p.limits.maxStudents === -1 ? 'Unlimited' : p.limits.maxStudents,
      MaxStaff: p.limits.maxStaff === -1 ? 'Unlimited' : p.limits.maxStaff,
      MaxStorage: p.limits.maxStorageMB === -1 ? 'Unlimited' : `${(p.limits.maxStorageMB / 1024).toFixed(1)} GB`,
      FeaturesCount: p.features.length
    })));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedPlans();
