import mongoose from "mongoose";
import { config } from "./config";
import { AppLogger } from "./logging/logger";



export class Context {
    public config: typeof config;

    constructor() {
        this.config = config;
    }

    //DB initialization
    public async initialize(): Promise<void> {
        try {
            await mongoose.connect(this.config.database.databaseUrl as string);
            AppLogger.info('🗄️ Database connected successfully');
        } catch (error) {
            AppLogger.error('❌ Database connection failed', error);
            throw error
        }
    }


    //DB shutdown
    public async shutdown(): Promise<void> {
        try {
            await mongoose.disconnect();
            AppLogger.info('🗄️ Database disconnected successfully');
        } catch (error) {
            AppLogger.error('❌ Database disconnection failed', error);
            throw error
        }
    }
}