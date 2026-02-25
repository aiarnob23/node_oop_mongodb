
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthRoutes } from "./auth.route";
import { BaseModule } from "../../core/BaseModule";
import { config } from "../../core/config";
import { AppLogger } from "../../core/logging/logger";
import { UserModel } from "./auth.model";
import { OTPModel } from "../OTP/otp.model";
import SESEmailService from "../../services/SESEmailService";
import { UserRole } from "./auth.interface";




export class AuthModule extends BaseModule {

    public readonly name = 'AuthModule';
    public readonly version = '1.0.0';
    public readonly dependencies = [];

    private authService!: AuthService;
    private authController!: AuthController;
    private authRoutes!: AuthRoutes;

    /**
     * Setup module services
     */
    protected async setupServices(): Promise<void> {
        if (!config.security.jwt.secret) {
            throw new Error('JWT_SECRET is required in environment variables');
        }

        //Initialize service
        this.authService = new AuthService(UserModel, OTPModel, new SESEmailService());
        AppLogger.info('AuthService initialized successfully');
    }

    /** 
     * Setup module routes
     */
    protected async setupRoutes(): Promise<void> {
        // Initialize controller
        this.authController = new AuthController(this.authService);
        AppLogger.info('AuthController initialized successfully');

        // Initialize routes
        this.authRoutes = new AuthRoutes(this.authController);
        AppLogger.info('AuthRoutes initialized successfully');

        // Mount routes under /api/auth
        this.router.use('/api/auth', this.authRoutes.getRouter());
    }

    /**
    * Custom initialization logic before services setup
    */
    protected override async onBeforeInit(): Promise<void> {
        if (!config.security.jwt.secret) {
            throw new Error(
                'JWT_SECRET environment variable is required for authentication module'
            );
        }

        if (!config.security.jwt.expiresIn) {
            AppLogger.warn('JWT_EXPIRES_IN not set, using default value: 1d');
        }

        AppLogger.info('AuthModule pre-initialization checks passed');
    }

    /**
 * Custom initialization logic after routes setup
 */
    protected override async onAfterInit(): Promise<void> {
        // Create default admin user if none exists
        await this.createDefaultAdmin();

        // Log authentication module status
        AppLogger.info('Authentication module initialized with the following configuration:', {
            jwtExpiresIn: config.security.jwt.expiresIn,
            jwtIssuer: config.security.jwt.issuer,
            environment: config.server.env,
        });
    }

    /**
 * Cleanup resources when module is shutting down
 */
    protected override async cleanup(): Promise<void> {
        // Perform cleanup tasks
        AppLogger.info('Cleaning up AuthModule resources...');

        // In a real application, you might want to:
        // - Invalidate active tokens
        // - Clear authentication caches
        // - Close any additional connections

        AppLogger.info('AuthModule cleanup completed');
    }

    /**
 * Create default admin user if none exists
 */
    private async createDefaultAdmin(): Promise<void> {
    try {
        const adminCount = await UserModel.countDocuments({ role: 'admin' });

        if (adminCount === 0) {
            const defaultAdminEmail =
                process.env.DEFAULT_SUPER_ADMIN_EMAIL || 'admin@example.com';
            const defaultAdminPassword =
                process.env.DEFAULT_SUPER_ADMIN_PASSWORD || '@Admin123';

            await this.authService.register({
                email: defaultAdminEmail,
                password: defaultAdminPassword,
                firstName: 'First',
                lastName: 'Admin',
                role: UserRole.ADMIN,
            });

            AppLogger.info('Default admin user created', {
                email: defaultAdminEmail,
            });
        }
    } catch (error) {
        AppLogger.error('Failed to create default admin user', { error });
    }
}

    // Getter methods for accessing module components (useful for testing and integration)
    public getAuthService(): AuthService {
        return this.authService;
    }

    public getAuthController(): AuthController {
        return this.authController;
    }
    /**
       * Get authentication statistics for monitoring
       */
    public async getModuleStats() {
        try {
            const [totalUsers, activeUsers, adminUsers] = await Promise.all([
                UserModel.countDocuments(),
                UserModel.countDocuments({ status: 'active' }),
                UserModel.countDocuments({ role: 'admin' }),
            ]);

            return {
                totalUsers,
                activeUsers,
                adminUsers,
                regularUsers: totalUsers - adminUsers,
            };
        } catch (error) {
            AppLogger.error('Failed to get AuthModule stats', { error });
            throw error;
        }
    }


}