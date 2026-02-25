import { Schema, model, type Model } from "mongoose";
import type { IOTP } from "./otp.interface";
import { OTPType } from "./otp.interface";

const otpSchema = new Schema<IOTP>(
  {
    identifier: {
      type: String,
      required: true,
      index: true, 
    },

    code: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: Object.values(OTPType),
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index:true,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);


// 🔥 Auto delete expired OTP (TTL Index)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTPModel: Model<IOTP> = model<IOTP>("OTP", otpSchema);