// backend/src/routes/userRoutes.ts
// User-bezogene Routen (geschützt)

import { Router, Request } from 'express';
import {
    getMe,
    updateMe,
    getAllUsers,
    getUserById,
    updateUserById,
    deleteAccount,
    deleteUser,
    updatePassword,
    updatePreferences,
} from '../controllers/userController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { UserRole } from '../models/userModel';

const router = Router();

// Lokaler Typ für Requests MIT User (vom authMiddleware gesetzt)
type RequestWithUser = Request & {
    user?: {
        id: number;
        role: UserRole;
    };
};

// alle Routen sind ab hier geschützt
router.use(authMiddleware);

/**
 * 👤 Aktueller User
 */
router.get('/me', getMe);
router.put('/me', updateMe);
router.delete('/me', deleteAccount);
router.put('/me/password', updatePassword);
router.put('/me/preferences', updatePreferences);

/**
 * 👥 Admin: alle User
 */
router.get('/', requireRole('admin'), getAllUsers);

/**
 * 👤 Admin ODER User selbst: einzelnes Profil
 */
router.get('/:id', (req, res, next) => {
    const { user } = req as RequestWithUser;

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestedId = Number(req.params.id);

    if (user.role === 'admin' || user.id === requestedId) {
        return getUserById(req, res, next);
    }

    return res.status(403).json({ error: 'Forbidden' });
});

/**
 * ✏️ Admin: beliebigen User per ID aktualisieren
 */
router.put('/:id', requireRole('admin'), updateUserById);

/**
 * 🗑️ Admin ODER User selbst: löschen
 */
router.delete('/:id', (req, res, next) => {
    const { user } = req as RequestWithUser;

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestedId = Number(req.params.id);

    if (user.role === 'admin' || user.id === requestedId) {
        return deleteUser(req, res, next);
    }

    return res.status(403).json({ error: 'Forbidden' });
});

export default router;
