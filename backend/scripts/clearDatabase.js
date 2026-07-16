// scripts/clearDatabase.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in the environment variables.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');
};

const clearDB = async () => {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    
    // Get all collections in the current database
    const collections = await db.listCollections().toArray();

    for (const coll of collections) {
      // Preserve the subscription plans we just seeded
      if (coll.name === 'subscriptionplans') {
        console.log(`ℹ️ Preserving collection: ${coll.name}`);
        continue;
      }
      
      console.log(`🗑️ Dropping collection: ${coll.name}`);
      await db.dropCollection(coll.name);
    }
    
    console.log('✨ Database cleared successfully (Subscription Plans preserved)! Ready for fresh onboarding.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
};

clearDB();
