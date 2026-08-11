const { pool } = require('./dist/config/db.config');

async function test() {
    try {
        console.log('Testing UPDATE query...');
        await pool.query(
                    `UPDATE notifications
                     SET action_status = 'expired'
                     WHERE LOWER(recipient_email) = LOWER($1)
                       AND (message LIKE '%You received a team invitation%' OR message LIKE '%requested to join your team%')
                       AND (action_status IS NULL OR action_status = 'pending')
                       AND (
                           created_at < NOW() - INTERVAL '48 hours'
                           OR (message LIKE '%You received a team invitation%' AND NOT EXISTS (
                               SELECT 1 FROM team_invitations 
                               WHERE LOWER(email) = LOWER($1) AND is_used = false AND expires_at > NOW()
                           ))
                           OR (message LIKE '%requested to join your team%' AND NOT EXISTS (
                               SELECT 1 FROM team_join_requests 
                               WHERE status = 'pending' AND created_at > NOW() - INTERVAL '48 hours'
                           ))
                       )`,
                    ['test@test.com']
                );
        console.log('Update Success.');
    } catch (err) {
        console.error('Update Error:', err);
    } finally {
        await pool.end();
    }
}

test();
