// import multer from 'multer';
// import path from 'path';
// import fs from 'fs';

// // Ensure tmp folder exists
// const tmpDir = 'tmp';
// if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, tmpDir);
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname));
//   },
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
//   fileFilter: (req, file, cb) => {
//     if (!file.mimetype.startsWith('image/')) {
//       return cb(new Error('Only images are allowed'));
//     }
//     cb(null, true);
//   },
// });

// export default upload;



import multer from "multer";

const storage = multer.diskStorage({});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files allowed"), false);
    }
    cb(null, true);
  },
});

export default upload;
