import type { Types } from "mongoose";

export enum UserRole {
    USER = "user",
    ADMIN = "admin",
}

export enum AccountStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    SUSPENDED = "suspended",
    PENDING_VERIFICATION = "pending_verification",
}

export interface IUser {
    _id: Types.ObjectId;
    email: string;
    username?: string;
    firstName: string;
    lastName?: string;
    displayName?: string;
    role: UserRole;
    status: AccountStatus;
    password: string;
    emailVerifiedAt?: Date;
    avatarUrl?: string;

    passwordResetAllowed?: boolean;
    passwordResetExpiresAt?: Date;
    isDeleted: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

