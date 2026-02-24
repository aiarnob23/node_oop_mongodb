import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { Context } from './Context';
import cookieParser from 'cookie-parser';
import { requestId } from '../middlewares/requestId';
import helmet from 'helmet';
import { config } from './config';
import cors from 'cors';


export class IgnitorApp {
    private app: Express;
    private context: Context;

    constructor() {
        this.app = express();
        this.context = new Context();
    }

    //initialize core
    private initialize(): void {
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
    }
}