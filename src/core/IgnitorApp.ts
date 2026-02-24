import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { Context } from './Context';
import cookieParser from 'cookie-parser';
import { requestId } from '../middlewares/requestId';
import helmet from 'helmet';
import { config } from './config';
import cors from 'cors';
import { AppError, RateLimitError, TimeoutError } from './errors/AppError';
import { requestLogger } from '../middlewares/requestLogger';
import rateLimit from 'express-rate-limit';
import { HTTPStatusCode } from '../types/HTTPStatusCode';
import mongoose from 'mongoose';
import { asyncHandler } from '../middlewares/asyncHandler';
import { AppLogger } from './logging/logger';
import type { IgnitorModule } from './IgnitorModule';


export class IgnitorApp {
    private app: Express;
    private context: Context;
    private modules: IgnitorModule[] = [];

    constructor() {
        this.app = express();
        this.context = new Context();
        this.initializeCore();
    }

    //initialize core
    private initializeCore(): void {
        // Trust proxy (important for rate limiting and IP detection)
        this.app.set('trust proxy', 1);

        // Compression middleware
        // this.app.use(compression());

        //Cookie parser
        this.app.use(cookieParser());

        //Request ID middleware (must be first)
        this.app.use(requestId());

        //Security middlewares
        this.app.use(
            helmet({
                contentSecurityPolicy: config.server.isProduction,
                crossOriginEmbedderPolicy: config.server.isProduction
            })
        )

        //CORS
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:5174',
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ]
        this.app.use(
            cors({
                origin: allowedOrigins,
                credentials: true,
                optionsSuccessStatus: 200,
            })
        )

        // Request parsing with size limits and error handling
        this.app.use(
            express.json({
                limit: '10mb',
                verify: (req, res, buf) => {
                    // Store raw body for webhook signature verification if needed
                    (req as any).rawBody = buf;
                },
            })
        );

        // Parse URL-encoded data
        this.app.use(
            express.urlencoded({
                extended: true,
                limit: '10mb',
            })
        );

        // Request timeout middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const timeout = setTimeout(() => {
                if (!res.headersSent) {
                    next(new TimeoutError('Request timeout'));
                }
            }, config.server.requestTimeout || 30000);

            res.on('finish', () => clearTimeout(timeout));
            res.on('close', () => clearTimeout(timeout));

            next();
        });

        // Request logging
        this.app.use(requestLogger());

        // Rate limiting
        if (config.server.isProduction) {
            this.app.use(
                rateLimit({
                    windowMs: config.security.rateLimit.windowMs,
                    max: config.security.rateLimit.max,
                    standardHeaders: true,
                    legacyHeaders: false,
                    handler: (req: Request, res: Response, next: NextFunction) => {
                        next(new RateLimitError());
                    },
                    skip: req => {
                        // Skip rate limiting for health check
                        return req.path === '/health';
                    },
                })
            );
        }

        // Health check endpoint
        this.app.get(
            '/health',
            asyncHandler(async (req: Request, res: Response) => {
                try {
                    // Check database connection
                    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
                        throw new Error('Database not connected');
                    }

                    await mongoose.connection.db.admin().ping();

                    // Uptime conversion function
                    const formatUptime = (seconds: number) => {
                        const days = Math.floor(seconds / (3600 * 24));
                        seconds %= 3600 * 24;
                        const hours = Math.floor(seconds / 3600);
                        seconds %= 3600;
                        const minutes = Math.floor(seconds / 60);
                        seconds = Math.floor(seconds % 60);
                        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
                    };

                    // Memory formatting
                    const formatMemory = (bytes: number) =>
                        `${(bytes / 1024 / 1024).toFixed(2)} MB`;

                    // CPU usage formatting
                    const formatCPU = (cpuUsage: NodeJS.CpuUsage) =>
                        `User: ${(cpuUsage.user / 1000).toFixed(2)}ms, System: ${(
                            cpuUsage.system / 1000
                        ).toFixed(2)}ms`;

                    const uptimeSeconds = process.uptime();
                    const healthData = {
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        uptime: formatUptime(uptimeSeconds),
                        environment: config.server.env,
                        version: process.env.npm_package_version || '1.0.0',
                        memoryUsage: {
                            rss: formatMemory(process.memoryUsage().rss),
                            heapTotal: formatMemory(process.memoryUsage().heapTotal),
                            heapUsed: formatMemory(process.memoryUsage().heapUsed),
                            external: formatMemory(process.memoryUsage().external),
                            arrayBuffers: formatMemory(process.memoryUsage().arrayBuffers),
                        },
                        cpuUsage: formatCPU(process.cpuUsage()),
                    };

                    res.status(200).json(healthData);
                } catch (error) {
                    throw new AppError(
                        HTTPStatusCode.SERVICE_UNAVAILABLE,
                        'Service unhealthy',
                        'SERVICE_UNAVAILABLE',
                        { reason: 'Database connection failed' }
                    );
                }
            })
        );


    }

    // Register a module
    public registerModule(module: IgnitorModule): void {
        this.modules.push(module);
        AppLogger.info(`🧩 Registered module: ${module.name}`);
    }
}