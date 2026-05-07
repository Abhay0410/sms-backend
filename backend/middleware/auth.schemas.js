import { z } from 'zod';

export const adminLoginSchema = z.object({
  adminID: z.string().min(1, "Admin ID is required"),
  password: z.string().min(1, "Password is required"),
  schoolId: z.string().min(1, "School ID is required")
});

export const parentLoginSchema = z.object({
  parentID: z.string().min(1, "Parent ID is required"),
  password: z.string().min(1, "Password is required"),
  schoolId: z.string().min(1, "School ID is required")
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters")
});