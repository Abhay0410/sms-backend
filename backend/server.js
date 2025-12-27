import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Import middleware
import { errorHandler } from "./middleware/errorHandler.js";

// Import routes
import schoolRoutes from './routes/school/school.routes.js';
import adminRoutes from "./routes/admin/admin.registration.routes.js";
import adminAuthRoutes from "./routes/auth/admin.auth.routes.js";
import teacherAuthRoutes from "./routes/auth/teacher.auth.routes.js";
import studentAuthRoutes from "./routes/auth/student.auth.routes.js";
import parentAuthRoutes from "./routes/auth/parent.auth.routes.js";
import adminStudentRoutes from "./routes/admin/admin.student.routes.js";
import adminTeacherRoutes from "./routes/admin/admin.teacher.routes.js";
import adminClassRoutes from "./routes/admin/admin.class.routes.js";
import adminTeacherManagementRoutes from "./routes/admin/admin.teacher.management.routes.js";
import adminStudentManagementRoutes from "./routes/admin/admin.student.management.routes.js";
import adminSubjectManagementRoutes from "./routes/admin/admin.subject.management.routes.js";
import adminTimetableRoutes from "./routes/admin/admin.timetable.routes.js";
import adminFeeRoutes from "./routes/admin/admin.fee.routes.js";
import adminAnnouncementRoutes from "./routes/admin/admin.announcement.routes.js";
import adminResultRoutes from "./routes/admin/admin.result.routes.js";
import teacherAttendanceRoutes from "./routes/teacher/teacher.attendance.routes.js";
import teacherResultRoutes from "./routes/teacher/teacher.result.routes.js";
import teacherTimetableRoutes from "./routes/teacher/teacher.timetable.routes.js";
import teacherAnnouncementRoutes from "./routes/teacher/teacher.announcement.routes.js";
import teacherMessageRoutes from "./routes/teacher/teacher.message.routes.js";
import studentAttendanceRoutes from "./routes/student/student.attendance.routes.js";
import studentFeeRoutes from "./routes/student/student.fee.routes.js";
import studentResultRoutes from "./routes/student/student.result.routes.js";
import studentAnnouncementRoutes from "./routes/student/student.announcement.routes.js";
import studentTimetableRoutes from "./routes/student/student.timetable.routes.js";
import studentMessageRoutes from "./routes/student/student.message.routes.js";
import parentAttendanceRoutes from "./routes/parent/parent.attendance.routes.js";
import parentResultRoutes from "./routes/parent/parent.result.routes.js";
import parentFeeRoutes from "./routes/parent/parent.fee.routes.js";
import parentAnnouncementRoutes from "./routes/parent/parent.announcement.routes.js";
import parentTimetableRoutes from "./routes/parent/parent.timetable.routes.js";
import parentMessageRoutes from "./routes/parent/parent.message.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ========================================
// SECURITY & MIDDLEWARE
// ========================================

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: isProd ? undefined : false
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 1000,
  message: { success: false, message: "Too many requests, please try again later." }
});
app.use("/api", limiter);

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !isProd || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: isProd ? '10kb' : '10mb' }));
app.use(express.urlencoded({ extended: true, limit: isProd ? '10kb' : '10mb' }));

// ✅ SAFE BODY-ONLY SANITIZER (Replaces express-mongo-sanitize & xss-clean)
// This prevents the "Cannot set property query" error by ignoring req.query entirely
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitizeValue = (val) => {
      if (typeof val !== 'string') return val;
      // 1. Basic NoSQL protection (remove $ and .)
      let sanitized = val.replace(/\$|\./g, '');
      // 2. Basic XSS protection (remove script tags and onEvent handlers)
      sanitized = sanitized
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+=/gi, '');
      return sanitized;
    };

    const walk = (obj) => {
      for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            walk(obj[key]);
          } else {
            obj[key] = sanitizeValue(obj[key]);
          }
        }
      }
    };
    walk(req.body);
  }
  next();
});

app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev'));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// ========================================
// DATABASE & ROUTES
// ========================================

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    if (isProd) setTimeout(connectDB, 5000);
    else process.exit(1);
  }
}
connectDB();

app.get("/health", (req, res) => res.json({ status: "up", env: process.env.NODE_ENV }));

// Route Registration
app.use('/api/schools', schoolRoutes);
app.use("/api/auth/admin", adminAuthRoutes);
app.use("/api/auth/teacher", teacherAuthRoutes);
app.use("/api/auth/student", studentAuthRoutes);
app.use("/api/auth/parent", parentAuthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/students", adminStudentRoutes);
app.use("/api/admin/teachers", adminTeacherRoutes);
app.use("/api/admin/classes", adminClassRoutes);
app.use("/api/admin/teacher-management", adminTeacherManagementRoutes);
app.use("/api/admin/student-management", adminStudentManagementRoutes);
app.use("/api/admin/subject-management", adminSubjectManagementRoutes);
app.use("/api/admin/timetable", adminTimetableRoutes);
app.use("/api/admin/fees", adminFeeRoutes);
app.use("/api/admin/announcements", adminAnnouncementRoutes);
app.use("/api/admin/results", adminResultRoutes);
app.use("/api/teacher/attendance", teacherAttendanceRoutes);
app.use("/api/teacher/result", teacherResultRoutes);
app.use("/api/teacher/timetable", teacherTimetableRoutes);
app.use("/api/teacher/announcements", teacherAnnouncementRoutes);
app.use("/api/teacher/messages", teacherMessageRoutes);
app.use("/api/student/attendance", studentAttendanceRoutes);
app.use("/api/student/fees", studentFeeRoutes);
app.use("/api/student/results", studentResultRoutes);
app.use("/api/student/announcements", studentAnnouncementRoutes);
app.use("/api/student/timetable", studentTimetableRoutes);
app.use("/api/student/messages", studentMessageRoutes);
app.use("/api/parent/attendance", parentAttendanceRoutes);
app.use("/api/parent/results", parentResultRoutes);
app.use("/api/parent/fees", parentFeeRoutes);
app.use("/api/parent/announcements", parentAnnouncementRoutes);
app.use("/api/parent/timetable", parentTimetableRoutes);
app.use("/api/parent/messages", parentMessageRoutes);

if (isProd) {
  const frontendPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(frontendPath));
  
  // FIXED: Added a name 'splat' to the wildcard '*'
  // This satisfies the Express 5 / path-to-regexp requirement
  app.get("/*splat", (req, res, next) => { 
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(frontendPath, "index.html"));
  });
}

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server on port ${PORT} (${isProd ? 'PROD' : 'DEV'})`));