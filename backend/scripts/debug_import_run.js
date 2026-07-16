// scripts/debug_import_run.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from '../models/School.js';
import Class from '../models/Class.js';
import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import Enrollment from '../models/Enrollment.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("DB connected.");

  const school = await School.findOne({});
  const schoolId = school._id;
  const academicYear = "2025-2026";

  const row = {
    Name: "Anaya Reddy",
    AdmissionID: "STU26052",
    RollNumber: "2",
    Email: "anaya.reddy@mail.com",
    ClassName: "10",
    Section: "B",
    ParentName: "Suresh Reddy",
    ParentPhone: "9723456781",
    Gender: "Female",
    ParentID: "PAR250002",
    ParentEmail: "suresh.reddy@parent.com"
  };

  const getVal = (row, key) => row[key] || "";

  try {
    const rawName = getVal(row, 'Name').trim();
    const className = getVal(row, 'ClassName').trim();
    const csvAdmissionID = getVal(row, 'AdmissionID').trim();
    const csvStudentID = getVal(row, 'StudentID').trim();

    let finalID = csvStudentID || csvAdmissionID;
    
    // Find class
    let targetClass = await Class.findOne({ schoolId, className: `Class ${className}`, academicYear });
    if (!targetClass) {
      console.log("Class not found");
      process.exit(0);
    }

    // Find parent
    const parentPhone = getVal(row, 'ParentPhone');
    const parentIDFromCSV = getVal(row, 'ParentID');
    
    let parent = await Parent.findOne({ schoolId, parentID: parentIDFromCSV });
    console.log("Parent in DB:", parent ? `Found parent: ${parent.name} (_id: ${parent._id})` : "Parent not found");

    // Try Student create
    const pass = "Student@123";
    const studentPayload = {
      schoolId, 
      name: rawName, 
      studentID: finalID, 
      admissionNumber: csvAdmissionID,
      mobileNumber: parentPhone || '0000000000',
      password: pass, 
      registrationYear: academicYear,
      targetGrade: targetClass.className, 
      parent: parent ? parent._id : undefined,
      gender: getVal(row, 'Gender') || 'Male', 
      status: 'ACTIVE',
      fatherName: getVal(row, 'ParentName') || rawName
    };

    console.log("Creating student with payload:", studentPayload);
    const newStudent = await Student.create(studentPayload);
    console.log("✅ Student created successfully!");

  } catch (err) {
    console.error("🔥 Error thrown:", err);
  }

  process.exit(0);
};

run().catch(console.error);
