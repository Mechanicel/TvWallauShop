// backend/src/types/express.d.ts

import type { UserRole } from './userModel';

declare global {
    namespace Express {
        interface AuthUser {
            id: number;
            role: UserRole;
        }

        interface Request {
            user?: AuthUser;
        }
    }
}

export {};
