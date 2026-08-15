import { pool } from '../src/config/db.config';

const addMessageEditCols = async () => {
    console.log("⏳ Connecting to PostgreSQL to update chat message tables...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log("1️⃣ Adding 'is_edited' to 'team_chat_messages'...");
        await client.query(`
            ALTER TABLE team_chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
        `);

        console.log("2️⃣ Adding 'is_edited' to 'committee_chat_messages'...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS committee_chat_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                image_url VARCHAR(500) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE committee_chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
        `);

        await client.query('COMMIT');
        console.log("✅ Database tables updated successfully!");
        process.exit(0);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error updating database tables:", err);
        process.exit(1);
    } finally {
        client.release();
    }
};

addMessageEditCols();
