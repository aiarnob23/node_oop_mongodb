// types/express.d.ts - Type definitions for Express extensions

import { JWTPayload } from "../middlewares/auth";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: JWTPayload;
      userId?: string;
      userRole?: string;
      rawBody?: Buffer;
      validatedQuery?: any;
      validatedParams?: any;
      validatedBody?: any;
    }
  }
}