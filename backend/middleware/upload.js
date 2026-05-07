import multer from "multer";
import path from "path";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary.js";

// ========================================
// REUSABLE FILE FILTERS
// ========================================

// Images only
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) cb(null, true);
  else cb(new Error("Only image files are allowed!"));
};

// Documents and images (Used for Announcements and Messages)
const documentFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (extname) cb(null, true);
  else cb(new Error("Only documents and images are allowed!"));
};

// ========================================
// STORAGE CONFIGURATIONS
// ========================================

// Generic folder generator based on school tenant
const getCloudinaryFolder = (req, subFolder) => {
  const schoolId = req.schoolId || "generic";
  return `sms/${schoolId}/${subFolder}`;
};

// Profile Storage ✅ UPDATED FOR MULTI-TENANCY
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req) => {
    const role = req.user?.role || "user";
    return {
      folder: getCloudinaryFolder(req, `${role}s_profiles`),
      public_id: `${role}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
    };
  },
});

// Message Attachments Storage (Supports Documents/PDFs) ✅ UPDATED FOR MULTI-TENANCY
const messageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req) => {
    return {
      folder: getCloudinaryFolder(req, "messages"),
      public_id: `msg-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      resource_type: "auto", 
    };
  }
});

// Announcement Storage ✅ UPDATED FOR MULTI-TENANCY
const announcementStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req) => {
    return {
      folder: getCloudinaryFolder(req, "announcements"),
      public_id: `announcement-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      resource_type: "auto",
    };
  }
});

// Document Storage
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req) => {
    return {
      folder: getCloudinaryFolder(req, "documents"),
      public_id: `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      resource_type: "auto",
    };
  }
});

// Result PDF Storage
const resultStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req) => {
    return {
      folder: getCloudinaryFolder(req, "results"),
      public_id: `result-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      resource_type: "auto",
      allowed_formats: ["pdf"],
    };
  }
});

// ========================================
// EXPORTED MULTER INSTANCES
// ========================================

export const upload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
});

export const uploadAnnouncementAttachments = multer({
  storage: announcementStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: documentFilter,
});

export const uploadMessageAttachments = multer({
  storage: messageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: documentFilter,
});

export const uploadDocuments = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFilter,
});

export const uploadResultPDF = multer({
  storage: resultStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error("Only PDF files allowed!"));
  },
});

export default upload;