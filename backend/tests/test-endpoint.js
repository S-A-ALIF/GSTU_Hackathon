const { generateToken } = require('./dist/config/jwt.config');
const http = require('http');

async function test() {
    const token = generateToken({ id: '1', email: 'test@test.com', role: 'user' });
    console.log('Generated Token:', token);

    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/notifications?email=test@test.com&skipUpdate=true',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    };

    const req = http.request(options, (res) => {
        console.log('STATUS:', res.statusCode);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log('BODY:', chunk);
        });
    });

    req.on('error', (e) => {
        console.error('Request error:', e.message);
    });

    req.end();
}

test();
