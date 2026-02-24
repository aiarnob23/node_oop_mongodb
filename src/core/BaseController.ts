import type { Request, Response } from "express";
import { HTTPStatusCode } from "../types/HTTPStatusCode";
import { config } from "./config";
import type { ApiResponse, PaginatedResponse } from "../types/types";
import { AppLogger } from "./logging/logger";

export abstract class BaseController {

    // ====================================================
    // RESPONSE HELPERS
    // ====================================================

    /**
     * Send a standard success response
     */
    protected sendResponse<T>(
        res: Response,
        message?: string,
        statusCode: HTTPStatusCode = HTTPStatusCode.OK,
        data?: T
    ): Response<ApiResponse<T>> {
        const response: ApiResponse<T> = {
            success: true,
            message,
            meta: {
                requestId: (res.req as any).id,
                timestamp: new Date().toISOString(),
            },
            data,
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Send a created (201) response
     */
    protected sendCreatedResponse<T>(
        res: Response,
        message: string = "Resource created successfully",
        data: T,
    ): Response<ApiResponse<T>> {
        return this.sendResponse(res, message, HTTPStatusCode.CREATED, data);
    }

    /**
     * Send a paginated response
     */
    protected sendPaginatedResponse<T>(
        res: Response,
        pagination: PaginatedResponse<T>["meta"]["pagination"],
        message?: string,
        data?: T[]
    ): Response<PaginatedResponse<T>> {
        const response: PaginatedResponse<T> = {
            success: true,
            message,
            meta: {
                requestId: (res.req as any).id,
                timestamp: new Date().toISOString(),
                pagination,
            },
            data,
        };

        return res.status(HTTPStatusCode.OK).json(response);
    }

    // ====================================================
    // AUTH / COOKIE HELPERS
    // ====================================================

    /**
     * Set secure HTTP-only auth cookie
     */
    protected setAuthCookie(res: Response, token: string): void {
        const cookieName = "auth_token";
        const maxAge = 24 * 60 * 60 * 1000; // 24h
        const isProduction = config.server.isProduction;

        res.cookie(cookieName, token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge,
            path: "/",
        });

        // Debug logging in non-production
        if (!isProduction) {
            console.log("🍪 Auth Cookie Set:", {
                name: cookieName,
                secure: isProduction,
                sameSite: isProduction ? "none" : "lax",
                env: config.server.env,
            });
        }
    }

    /**
     * Set a generic secure HTTP-only cookie
     */
    protected setCookie(
        res: Response,
        name: string,
        value: string,
        maxAge: number
    ): void {
        const isProduction = config.server.isProduction;

        res.cookie(name, value, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge,
            path: "/",
        });
    }

    // ====================================================
    // REQUEST HELPERS
    // ====================================================

    /**
     * Extract user ID from request (set by auth middleware)
     */
    protected getUserId(req: Request): string | undefined {
        return (req as any).userId;
    }

    /**
     * Extract pagination parameters from request
     */
    protected extractPaginationParams(req: Request): {
        page: number;
        limit: number;
        offset: number;
    } {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
        const offset = (page - 1) * limit;

        return { page, limit, offset };
    }

    // ====================================================
    // LOGGING
    // ====================================================

    /**
     * Log controller action
     */
    protected logAction(action: string, req: Request, metaData?: any): void {
        AppLogger.info(`Controller action: ${action}`, {
            requestId: (req as any).id,
            userId: (req as any).userId,
            method: req.method,
            path: req.path,
            ...metaData,
        });
    }
}
