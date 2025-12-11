// backend/src/routes/userRoutes.ts
// User-bezogene Routen (geschützt)

import { Router, Request, Response, NextFunction } from 'express';
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

const router = Router();

// Alle Routen ab hier sind geschützt
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
 * 👥 Admin: alle User sehen
 */
router.get('/', requireRole('admin'), getAllUsers);

/**
 * 👤 Admin ODER User selbst: einzelnes Profil
 */
router.get(
    '/:id',
    (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const requestedId = Number(req.params.id);

        if (user.role === 'admin' || user.id === requestedId) {
            return getUserById(req, res, next);
        }

        return res.status(403).json({ error: 'Forbidden' });
    }
);

/**
 * ✏️ Admin: beliebigen User per ID aktualisieren
 */
router.put('/:id', requireRole('admin'), updateUserById);

/**
 * 🗑️ Admin ODER User selbst: löschen
 */
router.delete(
    '/:id',
    (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const requestedId = Number(req.params.id);

        if (user.role === 'admin' || user.id === requestedId) {
            return deleteUser(req, res, next);
        }

        return res.status(403).json({ error: 'Forbidden' });
    }
);

export default router;
