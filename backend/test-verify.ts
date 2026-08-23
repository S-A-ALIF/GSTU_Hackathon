import { pool } from './src/config/db.config';
import { requestPasswordReset, verifyOtp } from './src/feats/auth/auth.service';
import crypto from 'crypto';

async function test() {
    const email = 'rate_test@test.com';

    try {
        console.log('1. Registering dummy user...');
        await pool.query('DELETE FROM users WHERE email = $1', [email]);
        const id = crypto.randomUUID();
        await pool.query("INSERT INTO users (id, email, password, role) VALUES ($1, $2, 'hash', 'student')", [id, email]);

        console.log('2. Requesting OTP 1 (should succeed)...');
        await requestPasswordReset(email);
        console.log('Success.');

        console.log('3. Requesting OTP 2 immediately (should fail with 429 and say 15 seconds)...');
        try {
            await requestPasswordReset(email);
            console.log('Failed: Should not have succeeded.');
        } catch (e: any) {
            console.log('Caught expected error:', e.message);
        }

        console.log('4. Verifying OTP logic (fetching from DB)...');
        const dbUser = await pool.query('SELECT reset_password_otp FROM users WHERE email = $1', [email]);
        const otp = dbUser.rows[0].reset_password_otp;
        console.log('Validating correct OTP:', otp);
        await verifyOtp(email, otp);
        console.log('Verification succeeded.');

        console.log('Validating wrong OTP: 0000');
        try {
            await verifyOtp(email, '0000');
            console.log('Failed: Should not have succeeded.');
        } catch (e: any) {
            console.log('Caught expected error:', e.message);
        }

    } catch (error) {
        console.error('Test script error:', error);
    } finally {
        await pool.end();
    }
}
test();
