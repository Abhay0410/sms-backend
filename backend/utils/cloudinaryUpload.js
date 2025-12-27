// utils/cloudinaryUpload.js
import cloudinary from '../config/cloudinary.js';
import fs from 'fs';

export const uploadToCloudinary = async (filePath, folder = 'school-management') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto', // Automatically detect file type
      use_filename: true,
      unique_filename: true
    });
    
    // Delete local file after upload
    fs.unlinkSync(filePath);
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type
    };
  } catch (error) {
    // Delete local file if upload fails
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return false;
  }
};

export const uploadMultipleToCloudinary = async (filePaths, folder = 'school-management') => {
  const uploadPromises = filePaths.map(filePath => uploadToCloudinary(filePath, folder));
  return await Promise.all(uploadPromises);
};
