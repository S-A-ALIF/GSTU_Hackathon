import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Initialize dotenv configuration before parsing the schemas
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Define the strict validation schema for environment inputs.
 * Zod coercion handles numeric casting automatically.
 * Default values are restored to ensure seamless local development if variables are omitted.
 */
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(5000),
    
    // Database Configuration Strings
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().default(5432),
    DB_USER: z.string().default('postgres'),
    DB_PASSWORD: z.string().default(''), 
    DB_NAME: z.string().default('neondb'),

    // Security & Services
    JWT_SECRET: z.string().default('super-secret-key-change-in-production'),
    EMAIL_USER: z.string().optional(),
    EMAIL_APP_PASSWORD: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    EMAIL_PASSWORD: z.string().optional(),
});

// Evaluate the system environment variables against the target criteria
const parsedEnv = envSchema.safeParse(process.env);

/**
 * Critical Fail-Fast Enforcement Block
 * If any environment variables fail schema validation (e.g., wrong types) on startup, 
 * kill the process immediately and return a formatted error tree.
 */
if (!parsedEnv.success) {
    console.error('❌ CRITICAL RUNTIME ERROR: Invalid system configuration variables:');
    console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
    process.exit(1);
}

/**
 * Export compiled configuration matrix as a frozen, immutable single-source object.
 * The external `DB_PASSWORD` is mapped to the internal `pass` property here.
 */
export const envConfig = {
    env: parsedEnv.data.NODE_ENV,
    port: parsedEnv.data.PORT,
    db: {
        host: parsedEnv.data.DB_HOST,
        port: parsedEnv.data.DB_PORT,
        user: parsedEnv.data.DB_USER,
        pass: parsedEnv.data.DB_PASSWORD,
        name: parsedEnv.data.DB_NAME,
    },
    jwt: {
        secret: parsedEnv.data.JWT_SECRET,
    },
    email: {
        user: parsedEnv.data.EMAIL_USER,
        pass: parsedEnv.data.EMAIL_APP_PASSWORD || parsedEnv.data.EMAIL_PASS || parsedEnv.data.EMAIL_PASSWORD,
    }
} as const;

// Warn if the default JWT secret is used in production — this is a critical security risk
if (envConfig.env === 'production' && envConfig.jwt.secret === 'super-secret-key-change-in-production') {
    console.error('🚨 CRITICAL SECURITY WARNING: You are using the default JWT_SECRET in production!');
    console.error('   Set a strong, random JWT_SECRET in your environment variables immediately.');
}

// Export the inferred type definition for downstream interface bindings if needed
export type EnvConfigType = typeof envConfig;