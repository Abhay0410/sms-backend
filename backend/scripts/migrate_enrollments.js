import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Enrollment from '../models/Enrollment.js';

dotenv.config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');
};

const migrateData = async () => {
  try {
    await connectDB();
    
    // Using native MongoDB collection to bypass Mongoose Schema strict mode 
    // (so we can read/delete the old 'class' fields that were removed from the Schema)
    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');
    
    const students = await studentsCollection.find({ class: { $exists: true } }).toArray();
    console.log(`🔍 Found ${students.length} legacy student records to migrate.`);

    let successCount = 0;
    let errorCount = 0;

    for (const student of students) {
      try {
        // 1. Create the new Junction record in Enrollment
        if (student.class && student.section && student.academicYear) {
          const existingEnrollment = await Enrollment.findOne({
            schoolId: student.schoolId,
            student: student._id,
            academicYear: student.academicYear
          });

          if (!existingEnrollment) {
            await Enrollment.create({
              schoolId: student.schoolId,
              student: student._id,
              class: student.class,
              className: student.className,
              section: student.section,
              academicYear: student.academicYear,
              rollNumber: student.rollNumber || null,
              status: 'ACTIVE'
            });
          }
        }

        // 2. Clean up the Student document and set new status
        await studentsCollection.updateOne(
          { _id: student._id },
          {
            $set: {
              status: 'ACTIVE',
              registrationYear: student.academicYear || new Date().getFullYear().toString()
            },
            $unset: {
              class: "",
              className: "",
              section: "",
              academicYear: "",
              rollNumber: ""
            }
          }
        );

        successCount++;
        if (successCount % 100 === 0) console.log(`🔄 Processed ${successCount} students...`);
      } catch (err) {
        console.error(`❌ Error processing student ${student._id}:`, err.message);
        errorCount++;
      }
    }

    console.log(`✅ Migration Complete! Success: ${successCount}, Errors: ${errorCount}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
};

migrateData();