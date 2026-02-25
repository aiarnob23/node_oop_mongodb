import { z } from "zod";
import { AccountStatus, UserRole } from "./auth.interface";

/* =====================================================
   COMMON SCHEMAS
===================================================== */

// Mongo ObjectId
const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid Mongo ObjectId");

// Enums
const roleSchema = z.enum(
    Object.values(UserRole) as [UserRole, ...UserRole[]]
);
const accountStatusSchema = z.enum(
    Object.values(AccountStatus) as [string, ...string[]]
);

// Email
const emailSchema = z
    .string()
    .email("Invalid email address")
    .min(5)
    .max(255)
    .transform((v) => v.toLowerCase().trim());

// Password
const passwordSchema = z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/^(?=.*[a-z])/, "Must contain one lowercase letter")
    .regex(/^(?=.*[A-Z])/, "Must contain one uppercase letter")
    .regex(/^(?=.*\d)/, "Must contain one number");

// OTP (STRING everywhere)
const otpCodeSchema = z
    .string()
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits");

// Username
const usernameSchema = z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and _")
    .trim();

/* =====================================================
   AUTH VALIDATIONS
===================================================== */

export const AuthValidation = {
    /* --------------------
       REGISTER
    -------------------- */
    register: z
        .object({
            email: emailSchema,
            password: passwordSchema,
            confirmPassword: passwordSchema,

            // Required (model এ required true)
            firstName: z
                .string()
                .min(2, "First name must be at least 2 characters")
                .max(100)
                .trim(),

            lastName: z
                .string()
                .min(2, "Last name must be at least 2 characters")
                .max(100)
                .trim()
                .optional(),

            role: roleSchema.optional(),
        })
        .strict()
        .refine((data) => data.password === data.confirmPassword, {
            message: "Passwords do not match",
            path: ["confirmPassword"],
        })
        .transform((data) => {
            const { confirmPassword, ...rest } = data;
            return rest;
        }),

    /* --------------------
       LOGIN
    -------------------- */
    login: z
        .object({
            email: emailSchema,
            password: z.string().min(1, "Password is required"),
        })
        .strict(),

    /* --------------------
       EMAIL VERIFICATION
    -------------------- */
    verifyEmail: z
        .object({
            email: emailSchema,
            code: otpCodeSchema,
        })
        .strict(),

    resendEmailVerification: z
        .object({
            email: emailSchema,
        })
        .strict(),

    /* --------------------
       FORGOT PASSWORD
    -------------------- */
    forgotPassword: z
        .object({
            email: emailSchema,
        })
        .strict(),

    verifyResetPasswordOTPInput: z
        .object({
            email: emailSchema,
            code: otpCodeSchema,
        })
        .strict(),

    resetPassword: z
        .object({
            email: emailSchema,
            newPassword: passwordSchema,
            confirmNewPassword: passwordSchema,
        })
        .strict()
        .refine((data) => data.newPassword === data.confirmNewPassword, {
            message: "Passwords do not match",
            path: ["confirmNewPassword"],
        })
        .transform((data) => {
            const { confirmNewPassword, ...rest } = data;
            return rest;
        }),

    /* --------------------
       CHANGE PASSWORD
    -------------------- */
    changePassword: z
        .object({
            currentPassword: z.string().min(1, "Current password is required"),
            newPassword: passwordSchema,
            confirmNewPassword: passwordSchema,
        })
        .strict()
        .refine((data) => data.newPassword === data.confirmNewPassword, {
            message: "New passwords do not match",
            path: ["confirmNewPassword"],
        })
        .refine((data) => data.currentPassword !== data.newPassword, {
            message: "New password must be different from current password",
            path: ["newPassword"],
        })
        .transform((data) => {
            const { confirmNewPassword, ...rest } = data;
            return rest;
        }),

    /* --------------------
       ADMIN UPDATE ROLE
    -------------------- */
    updateRole: z
        .object({
            role: roleSchema,
        })
        .strict(),

    /* --------------------
       REFRESH TOKEN
    -------------------- */
    refreshToken: z
        .object({
            token: z.string().min(1, "Token is required"),
        })
        .strict(),

    /* --------------------
       PARAM VALIDATION
    -------------------- */
    params: {
        userId: z.object({
            userId: objectIdSchema,
        }),
    },
};

/* =====================================================
   TYPE EXPORTS
===================================================== */

export type RegisterInput = z.infer<typeof AuthValidation.register>;
export type LoginInput = z.infer<typeof AuthValidation.login>;
export type VerifyEmailInput = z.infer<typeof AuthValidation.verifyEmail>;
export type ResendEmailVerificationInput = z.infer<
    typeof AuthValidation.resendEmailVerification
>;
export type ForgotPasswordInput = z.infer<
    typeof AuthValidation.forgotPassword
>;
export type VerifyResetPasswordOTPInput = z.infer<
    typeof AuthValidation.verifyResetPasswordOTPInput
>;
export type ResetPasswordInput = z.infer<
    typeof AuthValidation.resetPassword
>;
export type UpdateRoleInput = z.infer<typeof AuthValidation.updateRole>;
export type ChangePasswordInput = z.infer<
    typeof AuthValidation.changePassword
>;
export type RefreshTokenInput = z.infer<
    typeof AuthValidation.refreshToken
>;