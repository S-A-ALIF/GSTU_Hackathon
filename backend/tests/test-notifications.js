const { notificationService } = require('./dist/feats/notification/notification.service');
const { pool } = require('./dist/config/db.config');

async function test() {
    try {
        console.log('Testing getNotificationsByEmail...');
        const res = await notificationService.getNotificationsByEmail('admin@test.com', true);
        console.log('Success:', res.length, 'notifications found.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

test();
