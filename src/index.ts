import { AppLogger } from "./core/logging/logger";

// Main application bootstrap function
async function bootstrap() {
    try {
        AppLogger.info('📦 Starting application bootstrap');
    } catch (error) {
        console.log(error);
    }
}

//Graceful shutdown handler
// async function shutdown(app: IgnitorApp) {
//     AppLogger.info('Received shutdown signal, shutting down gracefully...');

//     try {
//         await app.shutdown();
//         AppLogger.info('Graceful shutdown completed');
//         process.exit(0);
//     } catch (error) {
//         AppLogger.error('❌ Shutdown error details:', error);

//         AppLogger.error('Error during graceful shutdown:', {
//             error: error instanceof Error ? error : new Error(String(error)),
//             context: 'graceful-shutdown',
//             stack: error instanceof Error ? error.stack : undefined,
//         });
//         process.exit(1);
//     }
// }


// Start the application
bootstrap().catch(err => {
    AppLogger.error('❌ Unhandled bootstrap error:', err);
    AppLogger.error('Bootstrap error:', {
        error: err instanceof Error ? err : new Error(String(err)),
        stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
});
