import Session from "../../models/Session.js";


// ✅ Get all sessions
// export const getAllSessions = async (req, res) => {
//       console.log("API HIT /session/all"); // 👈 add this
//   try {
//     const sessions = await Session.find().sort({ startYear: 1 }).lean();
//     res.status(200).json(sessions);
//   } catch (error) {
//     res.status(500).json({ message: "Error fetching sessions", error });
//   }
// };

// export const getAllSessions = async (req, res) => {
//   try {
//     const currentYear = new Date().getFullYear();

//     // 👉 Required range: past 2 → future 3
//     const requiredYears = [];
//     for (let i = -2; i <= 3; i++) {
//       requiredYears.push({
//         startYear: currentYear + i,
//         endYear: currentYear + i + 1,
//       });
//     }

//     // 👉 Existing sessions
//     // const existingSessions = await Session.find();
//     for (let yr of requiredYears) {
//   const exists = await Session.findOne({
//     startYear: yr.startYear,
//     endYear: yr.endYear,
//   });

//   if (!exists) {
//     await Session.create({
//       startYear: yr.startYear,
//       endYear: yr.endYear,
//       isActive: yr.startYear === currentYear,
//     });
//   }
// }

//     // 👉 Check & create missing sessions
//     for (let yr of requiredYears) {
//       const exists = existingSessions.find(
//         (s) =>
//           s.startYear === yr.startYear &&
//           s.endYear === yr.endYear
//       );

//       if (!exists) {
//         await Session.create({
//           startYear: yr.startYear,
//           endYear: yr.endYear,
//           isActive: yr.startYear === currentYear, // ✅ current active
//         });
//       }
//     }

//     // 👉 Ensure only ONE active session
//     await Session.updateMany(
//       { startYear: { $ne: currentYear } },
//       { isActive: false }
//     );

//     await Session.updateOne(
//       { startYear: currentYear },
//       { isActive: true }
//     );

//     // 👉 Final fetch (filtered + sorted)
//     const sessions = await Session.find({
//       startYear: {
//         $gte: currentYear - 2,
//         $lte: currentYear + 3,
//       },
//     })
//       .sort({ startYear: 1 })
//       .lean();

//     res.status(200).json(sessions);

//   } catch (error) {
//     res.status(500).json({ message: "Error fetching sessions", error });
//   }
// };

// export const getAllSessions = async (req, res) => {
//   try {
//     const now = new Date();
//     const currentYear = now.getFullYear();
//     const currentMonth = now.getMonth() + 1;

//     const activeStartYear =
//       currentMonth >= 4 ? currentYear : currentYear - 1;

//     // ✅ Required sessions
//     const requiredYears = [];
//     for (let i = -2; i <= 3; i++) {
//       requiredYears.push({
//         startYear: activeStartYear + i,
//         endYear: activeStartYear + i + 1,
//       });
//     }

//     // ✅ Create missing
//     for (let yr of requiredYears) {
//       const exists = await Session.findOne({
//         startYear: yr.startYear,
//         endYear: yr.endYear,
//       });

//       if (!exists) {
//         await Session.create({
//           startYear: yr.startYear,
//           endYear: yr.endYear,
//           isActive: yr.startYear === activeStartYear,
//         });
//       }
//     }

//     // ✅ Ensure only one active
//     await Session.updateMany(
//       { startYear: { $ne: activeStartYear } },
//       { isActive: false }
//     );

//     await Session.updateOne(
//       { startYear: activeStartYear },
//       { isActive: true }
//     );

//     // ✅ Fetch
//     const sessions = await Session.find({
//       startYear: {
//         $gte: activeStartYear - 2,
//         $lte: activeStartYear + 3,
//       },
//     })
//       .sort({ startYear: 1 })
//       .lean();

//     res.status(200).json(sessions);

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Error fetching sessions", error });
//   }
// };

export const getAllSessions = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const activeStartYear =
      currentMonth >= 4 ? currentYear : currentYear - 1;

    // ================================
    // ✅ STEP 1: REMOVE DUPLICATES (YAHAN DALNA HAI)
    // ================================
    const allSessions = await Session.find();

    const uniqueMap = new Map();

    for (let s of allSessions) {
      const key = `${s.startYear}-${s.endYear}`;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s._id);
      } else {
        await Session.findByIdAndDelete(s._id);
      }
    }

    // ================================
    // ✅ STEP 2: CREATE REQUIRED
    // ================================
    const requiredYears = [];

    for (let i = -2; i <= 3; i++) {
      requiredYears.push({
        startYear: activeStartYear + i,
        endYear: activeStartYear + i + 1,
      });
    }

    for (let yr of requiredYears) {
      const exists = await Session.findOne({
        startYear: yr.startYear,
        endYear: yr.endYear,
      });

      if (!exists) {
        await Session.create({
          startYear: yr.startYear,
          endYear: yr.endYear,
          isActive: yr.startYear === activeStartYear,
        });
      }
    }

    // ================================
    // ✅ STEP 3: ACTIVE FIX
    // ================================
    await Session.updateMany(
      { startYear: { $ne: activeStartYear } },
      { isActive: false }
    );

    await Session.updateOne(
      { startYear: activeStartYear },
      { isActive: true }
    );

    // ================================
    // ✅ STEP 4: FETCH
    // ================================
    const sessions = await Session.find({
      startYear: {
        $gte: activeStartYear - 2,
        $lte: activeStartYear + 3,
      },
    })
      .sort({ startYear: 1 })
      .lean();

    res.status(200).json(sessions);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching sessions", error });
  }
};


// ✅ Get active session
export const getActiveSession = async (req, res) => {
  try {
    const session = await Session.findOne({ isActive: true });

    if (!session) {
      return res.status(404).json({ message: "No active session found" });
    }

    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({ message: "Error fetching active session", error });
  }
};


// ✅ Create new session
export const createSession = async (req, res) => {
  try {
    const { startYear, endYear, isActive } = req.body;

    // 🔒 1. Duplicate check
    const existingSession = await Session.findOne({
      startYear,
      endYear,
    });

    if (existingSession) {
      return res.status(400).json({
        message: "Session already exists",
      });
    }

    // 🔒 2. Only one active session
    if (isActive) {
      await Session.updateMany({}, { isActive: false });
    }

    const newSession = new Session({
      startYear,
      endYear,
      isActive,
    });

    await newSession.save();

    res.status(201).json(newSession);
  } catch (error) {
    res.status(500).json({ message: "Error creating session", error });
  }
};

// ✅ Update session (activate/deactivate)
export const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // agar isko active bana rahe ho to baki sab inactive
    if (isActive) {
      await Session.updateMany({}, { isActive: false });
    }

    const updatedSession = await Session.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    res.status(200).json(updatedSession);
  } catch (error) {
    res.status(500).json({ message: "Error updating session", error });
  }
};