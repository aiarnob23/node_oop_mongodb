import express, { type Express } from 'express';
import { Context } from './Context';
import cookieParser from 'cookie-parser';


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
    }
}