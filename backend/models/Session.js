// import mongoose from "mongoose";

// const sessionSchema = new mongoose.Schema({
//   startYear: {
//     type: Number,
//     required: true,
//   },
//   endYear: {
//     type: Number,
//     required: true,
//   },
//   isActive: {
//     type: Boolean,
//     default: false,
//   },
// });

// export default mongoose.model("Session", sessionSchema);

import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  startYear: {
    type: Number,
    required: true,
  },
  endYear: {
    type: Number,
    required: true,
    validate: {
      validator: function (value) {
        return value === this.startYear + 1; // ✅ only valid session
      },
      message: "End year must be startYear + 1",
    },
  },
  isActive: {
    type: Boolean,
    default: false,
  },
});

// ✅ 1. Prevent duplicate sessions
sessionSchema.index(
  { startYear: 1, endYear: 1 },
  { unique: true }
);

export default mongoose.model("Session", sessionSchema);