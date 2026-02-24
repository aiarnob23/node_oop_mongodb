import mongoose from 'mongoose';
import {
    AppError,
    AuthenticationError,
    ConflictError,
    NotFoundError,
    PayloadTooLargeError,
    ValidationError,
} from './AppError';

import { HTTPStatusCode } from '../../types/HTTPStatusCode';
import { AppLogger } from '../logging/logger';
import type { NextFunction, Request, Response } from 'express';

interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code: string;
        statusCode: number;
        timestamp: string;
        requestId: string;
        details?: unknown;
        stack?: string;
    };
}

/**
 * Global Error Handler Middleware
 */
export function errorHandler() {
    return (err: unknown, req: Request, res: Response, next: NextFunction) => {
        // Response already sent hole default handler e paitye dibe
        if (res.headersSent) {
            return next(err);
        }

        const appError = normalizeError(err);

        const errorResponse: ErrorResponse = {
            success: false,
            error: {
                message: appError.message,
                code: appError.code,
                statusCode: appError.statusCode,
                timestamp: new Date().toISOString(),
                requestId: (req as any).id || 'unknown',
                ...(appError.details ? { details: appError.details } : {}),
                ...(process.env.NODE_ENV === 'development'
                    ? { stack: appError.stack }
                    : {}),
            },
        };

        logError(appError, req);

        res.status(appError.statusCode).json(errorResponse);
    };
}


 //  ERROR NORMALIZER (MONGODB & OTHERS)

function normalizeError(err: unknown): AppError {
    //  Already AppError hole direct return
    if (err instanceof AppError) {
        return err;
    }

    //  Mongoose Instance Errors (Specific classes)
    if (err instanceof mongoose.Error.ValidationError) {
        return new ValidationError('Validation failed', {
            errors: err.errors,
        });
    }

    if (err instanceof mongoose.Error.CastError) {
        return new AppError(
            HTTPStatusCode.BAD_REQUEST,
            `Invalid ${err.path}: ${err.value}`,
            'INVALID_ID'
        );
    }

    if (err instanceof mongoose.Error.DocumentNotFoundError) {
        return new NotFoundError('Resource not found');
    }

    if (err instanceof mongoose.Error.VersionError) {
        return new ConflictError('Document version conflict. Please retry.');
    }

    //  Generic Error and Name-based Checks (Solves 'unknown' type issue)
    if (err instanceof Error) {
        const errorName = err.name;

        // MongoDB Duplicate Key Error (Unique constraint)
        if ((err as any).code === 11000) {
            const fields = Object.keys((err as any).keyValue || {});
            return new ConflictError(`Duplicate field: ${fields.join(', ')}`, {
                fields,
            });
        }

        // DB Connection & Timeout Errors
        if (errorName === 'MongooseServerSelectionError' || errorName === 'MongoNetworkError') {
            return new AppError(
                HTTPStatusCode.SERVICE_UNAVAILABLE,
                'Database connection failed',
                'DB_CONNECTION_ERROR'
            );
        }

        // Parallel Save Error
        if (errorName === 'ParallelSaveError') {
            return new ConflictError('Concurrent update detected on the same document');
        }

        // Multer Errors
        if (errorName === 'MulterError') {
            return handleMulterError(err as any);
        }

        // JWT / Auth Errors
        if (errorName === 'JsonWebTokenError') return new AuthenticationError('Invalid token');
        if (errorName === 'TokenExpiredError') return new AuthenticationError('Token expired');

        // General Validation Errors (Zod, Joi, etc.)
        if (errorName === 'ValidationError') {
            return new ValidationError(err.message, { originalError: err });
        }

        // Catch-all for other standard Errors
        return new AppError(
            HTTPStatusCode.INTERNAL_SERVER_ERROR,
            err.message || 'Internal server error',
            'INTERNAL_ERROR',
            { originalError: err.message, stack: err.stack }
        );
    }

    //  Structural Errors (Like JSON parsing)
    if (err instanceof SyntaxError && 'body' in err) {
        return new AppError(
            HTTPStatusCode.BAD_REQUEST,
            'Invalid JSON in request body',
            'INVALID_JSON'
        );
    }

    //  Absolute Fallback
    return new AppError(
        HTTPStatusCode.INTERNAL_SERVER_ERROR,
        'An unknown error occurred',
        'UNKNOWN_ERROR',
        { originalError: String(err) }
    );
}

/* ===============================
   MULTER ERROR HANDLER
================================= */
function handleMulterError(err: any): AppError {
    switch (err.code) {
        case 'LIMIT_FILE_SIZE':
            return new PayloadTooLargeError('File size is too large');
        case 'LIMIT_FILE_COUNT':
            return new AppError(HTTPStatusCode.BAD_REQUEST, 'Too many files uploaded', 'TOO_MANY_FILES');
        case 'LIMIT_UNEXPECTED_FILE':
            return new AppError(HTTPStatusCode.BAD_REQUEST, 'Unexpected file field', 'UNEXPECTED_FILE');
        default:
            return new AppError(HTTPStatusCode.BAD_REQUEST, 'File upload error', 'FILE_UPLOAD_ERROR');
    }
}

/* ===============================
   LOGGER
================================= */
function logError(error: AppError, req: Request): void {
    const logMeta = {
        requestId: (req as any).id,
        method: req.method,
        path: req.originalUrl || req.path,
        ip: req.headers['x-forwarded-for'] || req.ip,
        statusCode: error.statusCode,
        code: error.code,
        isOperational: error.isOperational,
        ...(error.details ? { details: error.details } : {}),
    };

    if (error.statusCode >= 500) {
        AppLogger.error(`❌ ${error.message}`, { ...logMeta, stack: error.stack });
    } else {
        // Operational errors (4xx) are logged as warnings
        AppLogger.warn(`⚠️ ${error.message}`, logMeta);
    }
}