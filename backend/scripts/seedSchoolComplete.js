// scripts/seedSchoolComplete.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import School from '../models/School.js';
import Admin from '../models/Admin.js';
import Class from '../models/Class.js';
import { classSubjects, class11Streams, class12Streams } from './seedAcademicYear.js';

dotenv.config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');
};

const buildClassesForSchool = (schoolId, academicYear) => {
  const classes = [];

  // Pre-Primary
  ['Nursery', 'LKG', 'UKG'].forEach((className) => {
    const subjects = classSubjects[className];

    const sections = ['A', 'B'].map((sectionName) => ({
      sectionName,
      capacity: 30,
      currentStrength: 0,
      subjects: subjects.map((sub) => ({
        schoolId,
        subjectName: sub.name,
        subjectCode: sub.code,
        hasTheory: true,
        hasPractical: sub.hasPractical,
        hasIA: false,
        theoryMaxMarks: 100,
        practicalMaxMarks: 0,
        iaMaxMarks: 0,
      })),
    }));

    classes.push({
      schoolId,
      className,
      classNumeric: 0,
      academicYear,
      sections,
      commonSubjects: subjects.map((s) => s.name),
      isActive: true,
    });
  });

  // Classes 1–10
  for (let classNum = 1; classNum <= 10; classNum++) {
    const className = `Class ${classNum}`;
    const subjects = classSubjects[classNum.toString()];

    const sections = ['A', 'B', 'C'].map((sectionName) => ({
      sectionName,
      capacity: 50,
      currentStrength: 0,
      subjects: subjects.map((sub) => ({
        schoolId,
        subjectName: sub.name,
        subjectCode: sub.code,
        hasTheory: true,
        hasPractical: sub.hasPractical,
        hasIA: true,
        theoryMaxMarks: 100,
        practicalMaxMarks: sub.hasPractical ? 50 : 0,
        iaMaxMarks: 20,
      })),
    }));

    classes.push({
      schoolId,
      className,
      classNumeric: classNum,
      academicYear,
      sections,
      commonSubjects: subjects.map((s) => s.name),
      isActive: true,
    });
  }

  // Class 11
  ['Science', 'Commerce', 'Arts'].forEach((stream) => {
    const className = `Class 11 ${stream}`;
    const subjects = class11Streams[stream];

    const sections = ['A', 'B'].map((sectionName) => ({
      sectionName,
      capacity: 40,
      currentStrength: 0,
      subjects: subjects.map((sub) => ({
        schoolId,
        subjectName: sub.name,
        subjectCode: sub.code,
        hasTheory: true,
        hasPractical: sub.hasPractical,
        hasIA: true,
        theoryMaxMarks: 100,
        practicalMaxMarks: sub.hasPractical ? 50 : 0,
        iaMaxMarks: 20,
      })),
    }));

    classes.push({
      schoolId,
      className,
      classNumeric: 11,
      academicYear,
      sections,
      commonSubjects: subjects.map((s) => s.name),
      isActive: true,
    });
  });

  // Class 12
  ['Science', 'Commerce', 'Arts'].forEach((stream) => {
    const className = `Class 12 ${stream}`;
    const subjects = class12Streams[stream];

    const sections = ['A', 'B'].map((sectionName) => ({
      sectionName,
      capacity: 40,
      currentStrength: 0,
      subjects: subjects.map((sub) => ({
        schoolId,
        subjectName: sub.name,
        subjectCode: sub.code,
        hasTheory: true,
        hasPractical: sub.hasPractical,
        hasIA: true,
        theoryMaxMarks: 100,
        practicalMaxMarks: sub.hasPractical ? 50 : 0,
        iaMaxMarks: 20,
      })),
    }));

    classes.push({
      schoolId,
      className,
      classNumeric: 12,
      academicYear,
      sections,
      commonSubjects: subjects.map((s) => s.name),
      isActive: true,
    });
  });

  return classes;
};

const seedSchoolComplete = async (schoolCode) => {
  const academicYear = '2025-2026';

  const school = await School.findOne({ schoolCode });
  if (!school) throw new Error(`School ${schoolCode} not found`);

  const schoolId = school._id;
  console.log(`🏫 Setting up ${school.schoolName} (ID: ${schoolId})`);

  // Admin
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  await Admin.deleteMany({ schoolId });

  await Admin.create({
    schoolId,
    name: `${school.schoolName} Principal`,
    email: school.adminEmail,
    password: hashedPassword,
    adminID: `ADM${schoolCode.slice(-3)}`, // SCH001 -> ADM001
    phone: school.phone,
    isSuperAdmin: true,
    permissions: [
      { module: 'students', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'teachers', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'classes', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'fees', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'results', actions: ['create', 'read', 'update', 'delete', 'approve', 'publish'] },
      { module: 'attendance', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'announcements', actions: ['create', 'read', 'update', 'delete'] },
    ],
    role: 'admin',
    isActive: true,
  });

  await Class.deleteMany({ schoolId, academicYear });

  const classes = buildClassesForSchool(schoolId, academicYear);
  await Class.insertMany(classes);

  console.log(`✅ ${school.schoolName} COMPLETE SETUP!`);
  console.log(`   Admin Email: ${school.adminEmail}`);
  console.log(`   AdminID: ADM${schoolCode.slice(-3)}`);
};

const run = async () => {
  try {
    await connectDB();

    const schoolCodes = ['SCH001', 'SCH002', 'SCH003'];
    for (const code of schoolCodes) {
      console.log('\n' + '='.repeat(50));
      await seedSchoolComplete(code);
      console.log('='.repeat(50));
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

run();