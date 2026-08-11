import pg, { Pool, PoolConfig } from 'pg';
import { envConfig } from './env.config';

// Force pg driver to parse TIMESTAMP WITHOUT TIME ZONE (OID 1114) as UTC instead of local server time
pg.types.setTypeParser(1114, function(stringValue) {
    return new Date(stringValue + 'Z');
});

/**
 * Robust Pool Configuration Matrix
 * Consumes safely parsed and validated environment schemas directly from envConfig.
 */
const poolConfig: PoolConfig = {
    host: envConfig.db.host,
    port: envConfig.db.port,
    user: envConfig.db.user,
    password: envConfig.db.pass,
    database: envConfig.db.name,
    
    // Performance & Resource Tuning for Production Environments & Neon Serverless
    max: 20,                          // Maximum number of active clients allowed in the pool
    idleTimeoutMillis: 5000,          // Reduced to 5 seconds to recycle before Neon's 5m connection drop
    connectionTimeoutMillis: 10000,   // 10 seconds timeout for connections
    maxUses: 7500,                    // Recreate allocations after 7500 queries to mitigate memory leaks
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    
    // SSL: Neon and similar serverless Postgres providers require SSL but their pooler uses certificates
    // that don't match the hostname, so rejectUnauthorized must be false for compatibility.
    // For self-hosted databases, use { rejectUnauthorized: true, ca: fs.readFileSync('path/to/ca.pem') }
    ssl: (envConfig.env === 'production' || envConfig.db.host.includes('.neon.tech')) ? { rejectUnauthorized: false } : false
};

/**
 * The unified PostgreSQL Connection Pool Instance.
 * Shared globally across application layers to handle parallel querying efficiently.
 */
export const pool = new Pool(poolConfig);

/**
 * Operational Event Listeners
 * Vital for DevOps observability, telemetry, and handling unexpected connection drops gracefully.
 */
pool.on('connect', () => {
    // Log message only fires when a brand-new client allocation is instantiated inside the pool
    if (envConfig.env === 'development') {
        console.log('📦 Database Infrastructure: New client connection added to the pool.');
    }
});

pool.on('error', (error: Error) => {
    console.error('❌ CRITICAL DATABASE POOL ERROR: Unexpected client failure detected.', {
        message: error.message,
        stack: error.stack
    });
});

/**
 * Graceful Shutdown Utility
 * Ensures all pool connections drain cleanly during unexpected server restarts or SIGTERM signals.
 */
export const closeDatabaseConnection = async (): Promise<void> => {
    console.log('⏳ Database Infrastructure: Draining connection pool safely...');
    try {
        await pool.end();
        console.log('✅ Database Infrastructure: Connection pool closed cleanly.');
    } catch (error) {
        console.error('❌ Error occurred while breaking down database connection pool:', error);
        throw error;
    }
};

/**
 * Patch pool.query to automatically retry on "Connection terminated" errors.
 * This is crucial for serverless databases like Neon which may drop idle connections ungracefully.
 */
const originalQuery = pool.query.bind(pool);
(pool as any).query = async (...args: any[]) => {
    try {
        // @ts-ignore
        return await originalQuery(...args);
    } catch (error: any) {
        if (error.message && (error.message.includes('Connection terminated') || error.message.includes('Client has encountered a connection error') || error.message.includes('timeout'))) {
            console.warn('⚠️ Retrying query due to unexpected connection termination:', error.message);
            // @ts-ignore
            return await originalQuery(...args);
        }
        throw error;
    }
};