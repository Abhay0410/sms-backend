import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure all required uploads directories exist
const createUploadDirs = () => {
  const dirs = [
    path.join(__dirname, "../uploads"),
    path.join(__dirname, "../uploads/students"),
    path.join(__dirname, "../uploads/teachers"),
    path.join(__dirname, "../uploads/parents"),
    path.join(__dirname, "../uploads/admin"),
    path.join(__dirname, "../uploads/announcements"),
    path.join(__dirname, "../uploads/messages"), // ✅ Dedicated folder for T-S-P messages
    path.join(__dirname, "../uploads/results"),
    path.join(__dirname, "../uploads/documents"),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
};

createUploadDirs();

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

// Profile Storage
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let roleFolder = req.user?.role ? `${req.user.role}s` : "students";
    cb(null, path.join(__dirname, `../uploads/${roleFolder}`));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${req.user?.role || "user"}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Message Attachments Storage ✅ NEW
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads/messages"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `msg-${uniqueSuffix}-${sanitizedName}`);
  },
});

// Announcement Storage
const announcementStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads/announcements"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `announcement-${uniqueSuffix}-${sanitizedName}`);
  },
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

// ✅ Export the instance used in teacher.message.routes.js
export const uploadMessageAttachments = multer({
  storage: messageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: documentFilter,
});

export const uploadDocuments = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads/documents")),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `doc-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFilter,
});

export const uploadResultPDF = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads/results")),
    filename: (req, file, cb) => cb(null, `result-${Date.now()}.pdf`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error("Only PDF files allowed!"));
  },
});

export default upload;