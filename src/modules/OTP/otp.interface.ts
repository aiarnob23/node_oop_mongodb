import type { Types } from "mongoose";

export enum OTPType {
    email_verification = "email_verification",
    login_verification = "login_verification",
    password_reset = "password_reset",
    two_factor = "two_factor",
}

export interface IOTP {
    _id: Types.ObjectId;
    identifier: string;
    code: string;
    type: OTPType;
    expiresAt: Date;
    verified: boolean;
    attempts: number;
    createdAt: Date;
    updatedAt: Date;
    userId?: Types.ObjectId;
}