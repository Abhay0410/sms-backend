import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    logger.error(`Error deleting from Cloudinary: ${publicId}`, { error: error.message });
  }
};

export default cloudinary;