import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

afterAll(async () => {
  // Close mongoose connection after tests complete to avoid open handles
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});