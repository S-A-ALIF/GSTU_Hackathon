import jwt from 'jsonwebtoken';
import { envConfig } from './env.config';

export interface JwtPayload {
    id: string;
    email: string;
    role: 'student' | 'mentor' | 'admin';
    iat?: number;
    exp?: number;
}

const JWT_SECRET = envConfig.jwt.secret;
const JWT_EXPIRES_IN = '7d';

export const generateToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};

export const verifyToken = (token: string): JwtPayload => {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
};