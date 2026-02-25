import { Schema, model } from "mongoose";
import { AccountStatus, UserRole, type IUser } from "./auth.interface";


const userSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },

        username: {
            type: String,
            unique: true,
            sparse: true,
        },

        firstName: {
            type: String,
            required: true,
        },

        lastName: {
            type: String,
        },

        displayName: {
            type: String,
        },

        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.USER,
        },

        status: {
            type: String,
            enum: Object.values(AccountStatus),
            default: AccountStatus.PENDING_VERIFICATION,
        },

        password: {
            type: String,
            required: true,
        },

        emailVerifiedAt: Date,
        avatarUrl: String,
        passwordResetAllowed: {
            type:Boolean,
            default: false
        },
        passwordResetExpiresAt: Date,
        isDeleted: {
            type: Boolean,
            default: false,
        },

        lastLoginAt: Date,
        deletedAt: Date,
    },
    {
        timestamps: true, // createdAt & updatedAt
    }
);

export const UserModel = model<IUser>("User", userSchema);