import School from "../../models/School.js";
import Student from "../../models/Student.js";
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

// GET /api/superadmin/metrics/dashboard
// @desc Get global aggregated stats for the Super Admin dashboard
export const getDashboardMetrics = asyncHandler(async (req, res) => {
  // 1. School Stats
  const totalSchools = await School.countDocuments();
  const activeSchools = await School.countDocuments({ status: "ACTIVE" });
  const suspendedSchools = await School.countDocuments({ status: "SUSPENDED" });

  // 2. Student Stats (Across all tenants)
  const totalActiveStudents = await Student.countDocuments({ status: "ACTIVE", isDeleted: false });

  // 3. Financial Stats (Calculate MRR based on active subscriptions)
  const schoolsWithPlans = await School.find({ status: "ACTIVE" }).populate("subscription", "monthlyPrice");
  const monthlyRecurringRevenue = schoolsWithPlans.reduce((sum, school) => {
    return sum + (school.subscription?.monthlyPrice || 0);
  }, 0);

  // 4. System/Resource Stats
  const storageAggregation = await School.aggregate([
    { $group: { _id: null, totalStorage: { $sum: "$storageUsed" } } }
  ]);
  const totalStorageUsedMB = storageAggregation.length > 0 ? storageAggregation[0].totalStorage : 0;

  // 5. Recent Onboardings (For a quick view table)
  const recentSchools = await School.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("schoolName subdomain status createdAt")
    .lean();

  return successResponse(res, "Dashboard metrics retrieved successfully", {
    metrics: {
      schools: {
        total: totalSchools,
        active: activeSchools,
        suspended: suspendedSchools
      },
      students: {
        totalActive: totalActiveStudents
      },
      revenue: {
        mrr: monthlyRecurringRevenue
      },
      resources: {
        totalStorageUsedMB
      },
      recentSchools
    }
  });
});