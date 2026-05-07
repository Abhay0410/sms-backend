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
import mongoSanitize from "express-mongo-sanitize";
import Session from "./models/Session.js";
import logger from "./utils/logger.js";
import { auditLogger } from "./middleware/auditLog.js";
import { swaggerDocs } from "./utils/swagger.js";

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
import adminEnquiryRoutes from "./routes/admin/admin.enquiry.routes.js";
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
import adminHRRoutes from "./routes/admin/admin.hr.routes.js";
import teacherHRRoutes from "./routes/teacher/teacher.hr.routes.js";
import teacherPayrollRoutes from "./routes/admin/admin.payroll.routes.js";
import adminLibraryRoutes from "./routes/admin/admin.library.routes.js";
import adminOnboardingRoutes from "./routes/admin/onboarding.routes.js";
import adminTransportRoutes from "./routes/admin/admin.transport.routes.js";
import adminExpenseRoutes from "./routes/admin/admin.expense.routes.js";
import adminInventoryRoutes from "./routes/admin/admin.inventory.routes.js";
import sessionRoutes from "./routes/session/session.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
logger.info("Environment variables loaded", {
  JWT_SECRET_EXISTS: !!process.env.JWT_SECRET,
  MONGODB_URI_EXISTS: !!process.env.MONGODB_URI
});
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

// Data sanitization against NoSQL query injection (Express 5 Safe)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

// Data sanitization against XSS (Express 5 Safe)
const cleanXSS = (obj) => {
  if (!obj) return;
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      cleanXSS(obj[key]);
    }
  }
};
app.use((req, res, next) => {
  if (req.body) cleanXSS(req.body);
  if (req.query) cleanXSS(req.query);
  if (req.params) cleanXSS(req.params);
  next();
});

app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev'));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Initialize Audit Logging for state-changing requests globally
app.use(auditLogger);

// ========================================
// DATABASE & ROUTES
// ========================================

const autoCreateSession = async () => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const startYear = month >= 3 ? year : year - 1; // April logic
    const endYear = startYear + 1;

    const exists = await Session.findOne({ startYear, endYear });

    if (!exists) {
  await Session.updateMany({ isActive: true }, { isActive: false });

  await Session.create({
    startYear,
    endYear,
    isActive: true,
  });

  logger.info(`Auto session created: ${startYear}-${endYear}`);
} else {
  // 👉 ensure active
  if (!exists.isActive) {
    await Session.updateMany({}, { isActive: false });

    exists.isActive = true;
    await exists.save();

    logger.info(`Session activated: ${startYear}-${endYear}`);
  } else {
    logger.debug("Session already active");
  }
}
  } catch (error) {
    logger.error("Auto session error", { error: error.message });
  }
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("MongoDB Connected", { db: mongoose.connection.name });
  } catch (err) {
    logger.error("DB Error", { error: err.message });
    if (isProd) setTimeout(connectDB, 5000);
    else process.exit(1);
  }
}
// connectDB();
connectDB().then(() => {
  autoCreateSession();
});

app.get("/health", (req, res) => res.json({ status: "up", env: process.env.NODE_ENV }));

// Route Registration
app.use('/api/schools', schoolRoutes);
app.use("/api/session", sessionRoutes);
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
app.use("/api/admin/enquiry", adminEnquiryRoutes); // Matches frontend constants
app.use("/api/admin/enquiries", adminEnquiryRoutes); // Kept for backward compatibility
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
// Register HR Modules
app.use("/api/admin/hr", adminHRRoutes);
app.use("/api/admin/payroll", teacherPayrollRoutes);
app.use("/api/teacher/hr", teacherHRRoutes);

app.use("/api/student/messages", studentMessageRoutes);
app.use("/api/parent/attendance", parentAttendanceRoutes);
app.use("/api/parent/results", parentResultRoutes);
app.use("/api/parent/fees", parentFeeRoutes);
app.use("/api/parent/announcements", parentAnnouncementRoutes);
app.use("/api/parent/timetable", parentTimetableRoutes);
app.use("/api/parent/messages", parentMessageRoutes);

app.use("/api/admin/library", adminLibraryRoutes);
app.use("/api/admin/onboarding", adminOnboardingRoutes);
app.use("/api/admin/transport", adminTransportRoutes);
app.use("/api/admin/expense", adminExpenseRoutes);
app.use("/api/admin/inventory", adminInventoryRoutes);

// Error handler humesha sabse niche hona chahiye
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
swaggerDocs(app, PORT);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, "0.0.0.0", () => logger.info(`🚀 Server on port ${PORT} (${isProd ? 'PROD' : 'DEV'})`));
}

export default app;