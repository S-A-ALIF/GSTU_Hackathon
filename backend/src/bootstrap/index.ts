import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { envConfig } from '../config/env.config';
import { pool } from '../config/db.config';
import rootRouter from '../routes';
import { errorHandler } from '../middlewares/errorMiddleware';

const app: Application = express();

// Global Middleware
// CRITICAL: Allow credentials (cookies/sessions) and support Vercel/localhost origins
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "https://gstu-cse-hackethon-vert.vercel.app",
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origin ${origin} not allowed`), false);
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root Route (so visiting the Render URL doesn't show "Not Found")
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'GSTU Hackathon API is running successfully!',
        healthCheck: '/health',
        apiEndpoint: '/api/v1'
    });
});

// Basic Health Check Route
app.get('/health', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT NOW()');
        
        res.status(200).json({
            status: 'success',
            message: 'Server is running perfectly.',
            databaseTime: result.rows[0].now,
        });
    } catch (error) {
        console.error('Database connection failed during health check:', error);
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.use('/api/v1', rootRouter);
app.use(errorHandler);

import { Server as SocketIOServer } from 'socket.io';

const PORT = envConfig.port || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`Environment: ${envConfig.env}`);
    pool.query(`
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_status VARCHAR(20) DEFAULT NULL;
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT NULL;
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS admin_message_id UUID DEFAULT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
        ALTER TABLE team_chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
        ALTER TABLE committee_chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_code VARCHAR(20) UNIQUE DEFAULT NULL;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_full BOOLEAN DEFAULT false;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS repo_url VARCHAR(500) DEFAULT NULL;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS live_url VARCHAR(500) DEFAULT NULL;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS video_url VARCHAR(500) DEFAULT NULL;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN DEFAULT false;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP DEFAULT NULL;
        UPDATE teams SET team_code = 'TM-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)) WHERE team_code IS NULL;
        CREATE TABLE IF NOT EXISTS team_join_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(team_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS team_chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
            sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS team_chat_reads (
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
            last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, team_id)
        );

        CREATE TABLE IF NOT EXISTS problems (
            id SERIAL PRIMARY KEY,
            track VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            difficulty VARCHAR(50) NOT NULL,
            description TEXT NOT NULL,
            criteria JSONB NOT NULL,
            prize VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS rules (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL DEFAULT 'Hackathon Rules & Regulations',
            content TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS platform_settings (
            key VARCHAR(50) PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS admin_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) DEFAULT '',
            message TEXT NOT NULL,
            target_type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) DEFAULT 'info',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS committee_chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS committee_chat_reads (
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id)
        );
        INSERT INTO platform_settings (key, value) VALUES ('registration_open', 'true') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('workspace_open', 'false') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('problems_open', 'false') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('min_team_members', '3') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('max_team_members', '5') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('reg_start_time', '') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('reg_end_time', '') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('hack_start_time', '') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('hack_end_time', '') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('reg_override', 'false') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('hack_override', 'false') ON CONFLICT (key) DO NOTHING;
        INSERT INTO platform_settings (key, value) VALUES ('prob_override', 'false') ON CONFLICT (key) DO NOTHING;
    `).catch(err => {
        console.error('Migration error during startup:', err);
    });
});

const io = new SocketIOServer(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
                callback(null, true);
            } else {
                callback(new Error(`CORS: Origin ${origin} not allowed`), false);
            }
        },
        credentials: true
    }
});

app.locals.io = io;

io.on('connection', (socket) => {
    console.log('⚡ Client connected to WebSocket');
    
    // Authenticate socket
    socket.on('authenticate', (userId) => {
        socket.join(`user_${userId}`);
        
        // Allow joining committee chat room if authorized
        socket.on('joinCommitteeChat', () => {
            socket.join('committee_chat');
        });
        
        socket.on('leaveCommitteeChat', () => {
            socket.leave('committee_chat');
        });
    });

    socket.on('joinTeamChat', (teamId) => {
        const roomName = `team_${teamId}`;
        socket.join(roomName);
        console.log(`🔌 Socket joined team room: ${roomName}`);
    });

    socket.on('leaveTeamChat', (teamId) => {
        const roomName = `team_${teamId}`;
        socket.leave(roomName);
        console.log(`🔌 Socket left room: ${roomName}`);
    });

    socket.on('disconnect', () => {
        console.log('⚡ Client disconnected from WebSocket');
    });
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} received. Closing server...`);
    server.close(async () => {
        try {
            await pool.end();
            console.log('✅ Database connections drained.');
            process.exit(0);
        } catch (err) {
            console.error('❌ Error during database pool shutdown:', err);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;