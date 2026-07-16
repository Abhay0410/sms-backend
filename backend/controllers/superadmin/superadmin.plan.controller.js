import SubscriptionPlan from "../../models/SubscriptionPlan.js";
import School from "../../models/School.js";
import { successResponse } from "../../utils/response.js";
import { ValidationError, NotFoundError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import logger from "../../utils/logger.js";

// GET /api/superadmin/plans
// @desc Get all subscription plans
export const getAllPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find().sort({ monthlyPrice: 1 }).lean();
  return successResponse(res, "Subscription plans retrieved successfully", { plans });
});

// GET /api/superadmin/plans/:id
// @desc Get specific plan details
export const getPlanById = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id).lean();
  if (!plan) throw new NotFoundError("Subscription plan not found");
  
  return successResponse(res, "Subscription plan retrieved", { plan });
});

// POST /api/superadmin/plans
// @desc Create a new subscription plan
export const createPlan = asyncHandler(async (req, res) => {
  const { name, monthlyPrice, yearlyPrice, limits, features } = req.body;

  if (!name || monthlyPrice === undefined || yearlyPrice === undefined || !limits || limits.maxStudents === undefined || limits.maxStaff === undefined) {
    throw new ValidationError("Name, monthlyPrice, yearlyPrice, limits.maxStudents, and limits.maxStaff are required");
  }

  const existingPlan = await SubscriptionPlan.findOne({ name: name.toUpperCase() });
  if (existingPlan) throw new ValidationError(`Plan with name ${name} already exists`);

  const plan = await SubscriptionPlan.create({
    name: name.toUpperCase(),
    monthlyPrice,
    yearlyPrice,
    limits,
    features: features || []
  });

  logger.info("New Subscription Plan created", { planId: plan._id, adminId: req.superAdmin._id });

  return successResponse(res, "Subscription plan created successfully", { plan }, 201);
});

// PUT /api/superadmin/plans/:id
// @desc Update an existing subscription plan
export const updatePlan = asyncHandler(async (req, res) => {
  const { name, monthlyPrice, yearlyPrice, limits, features } = req.body;
  
  const updateData = {};
  if (name) updateData.name = name.toUpperCase();
  if (monthlyPrice !== undefined) updateData.monthlyPrice = monthlyPrice;
  if (yearlyPrice !== undefined) updateData.yearlyPrice = yearlyPrice;
  if (limits) updateData.limits = limits;
  if (features) updateData.features = features;

  const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  if (!plan) throw new NotFoundError("Subscription plan not found");

  logger.info("Subscription Plan updated", { planId: plan._id, adminId: req.superAdmin._id });

  return successResponse(res, "Subscription plan updated successfully", { plan });
});

// PATCH /api/superadmin/plans/assign/:schoolId
// @desc Upgrade or Downgrade a specific school's plan
export const assignPlanToSchool = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const { schoolId } = req.params;
  
  if (!planId) throw new ValidationError("Plan ID is required");
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) throw new NotFoundError("Subscription plan not found");

  const school = await School.findByIdAndUpdate(
    schoolId,
    { 
      subscription: plan._id, 
      modulesEnabled: plan.features || [], 
      subscriptionPlan: plan.name, 
      maxStudents: plan.limits?.maxStudents !== undefined ? plan.limits.maxStudents : 1000,
      maxStaff: plan.limits?.maxStaff !== undefined ? plan.limits.maxStaff : 50,
      maxStorageMB: plan.limits?.maxStorageMB !== undefined ? plan.limits.maxStorageMB : 5000
    },
    { new: true }
  );
  if (!school) throw new NotFoundError("School not found");

  logger.info(`Assigned plan ${plan.name} to school ${school.schoolName}`, { schoolId: school._id, planId: plan._id, adminId: req.superAdmin._id });
  return successResponse(res, `Successfully assigned ${plan.name} plan to school`, { school });
});