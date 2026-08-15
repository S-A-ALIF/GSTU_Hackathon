import { pool } from '../src/config/db.config';

const initAllTables = async () => {
    console.log("⏳ Connecting to PostgreSQL to initialize all database tables...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log("1️⃣ Creating 'users' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'student',
                is_banned BOOLEAN DEFAULT false,
                ban_reason TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
        `);

        console.log("2️⃣ Creating 'user_info' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_info (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255),
                student_id VARCHAR(255),
                batch_session VARCHAR(255),
                phone_number VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );
        `);

        console.log("3️⃣ Creating 'teams', 'team_members', 'team_invitations', 'team_join_requests', and 'mentor_invitations' tables...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                leader_id UUID REFERENCES users(id) ON DELETE CASCADE,
                mentor_id UUID REFERENCES users(id) ON DELETE SET NULL,
                team_code VARCHAR(20) UNIQUE DEFAULT NULL,
                is_full BOOLEAN DEFAULT false,
                is_banned BOOLEAN DEFAULT false,
                ban_reason TEXT DEFAULT NULL,
                repo_url VARCHAR(500) DEFAULT NULL,
                live_url VARCHAR(500) DEFAULT NULL,
                video_url VARCHAR(500) DEFAULT NULL,
                is_submitted BOOLEAN DEFAULT false,
                submitted_at TIMESTAMP DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS mentor_id UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_code VARCHAR(20) UNIQUE DEFAULT NULL;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_full BOOLEAN DEFAULT false;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS repo_url VARCHAR(500) DEFAULT NULL;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS live_url VARCHAR(500) DEFAULT NULL;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS video_url VARCHAR(500) DEFAULT NULL;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN DEFAULT false;
            ALTER TABLE teams ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP DEFAULT NULL;

            CREATE TABLE IF NOT EXISTS team_members (
                team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (team_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS team_invitations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                pin_code VARCHAR(6) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                is_used BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS team_join_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(team_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS mentor_invitations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
                mentor_id UUID REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS team_chat_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
                sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("4️⃣ Creating 'notifications' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                recipient_email VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT false,
                action_status VARCHAR(20) DEFAULT NULL,
                type VARCHAR(50) DEFAULT NULL,
                admin_message_id UUID DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_status VARCHAR(20) DEFAULT NULL;
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT NULL;
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS admin_message_id UUID DEFAULT NULL;
        `);

        console.log("5️⃣ Creating 'platform_settings' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_settings (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT NOT NULL
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
        `);

        console.log("6️⃣ Creating 'feedback' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS feedback (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                subject VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP DEFAULT NULL
            );
        `);

        console.log("7️⃣ Creating 'problems' table...");
        await client.query(`
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
        `);

        console.log("8️⃣ Creating 'rules' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS rules (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL DEFAULT 'Hackathon Rules & Regulations',
                content TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("9️⃣ Creating 'admin_messages' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) DEFAULT '',
                message TEXT NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                severity VARCHAR(20) DEFAULT 'info',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Generate team codes for any teams that don't have one yet
        await client.query(`
            UPDATE teams SET team_code = 'TM-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)) WHERE team_code IS NULL;
        `);

        await client.query('COMMIT');
        console.log("✅ All database tables initialized successfully!");
        process.exit(0);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error initializing database tables:", err);
        process.exit(1);
    } finally {
        client.release();
    }
};

initAllTables();

