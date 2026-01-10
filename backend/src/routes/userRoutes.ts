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
import type { UserRole } from '@tvwallaushop/contracts';

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
/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user details.
 */
router.get('/me', getMe);
/**
 * @openapi
 * /users/me:
 *   put:
 *     tags: [Users]
 *     summary: Update current user profile.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated profile.
 */
router.put('/me', updateMe);
/**
 * @openapi
 * /users/me:
 *   delete:
 *     tags: [Users]
 *     summary: Delete current user account.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account deleted.
 */
router.delete('/me', deleteAccount);
/**
 * @openapi
 * /users/me/password:
 *   put:
 *     tags: [Users]
 *     summary: Update current user password.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Password updated.
 */
router.put('/me/password', updatePassword);
/**
 * @openapi
 * /users/me/preferences:
 *   put:
 *     tags: [Users]
 *     summary: Update current user preferences.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Preferences updated.
 */
router.put('/me/preferences', updatePreferences);

/**
 * 👥 Admin: alle User
 */
/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users (admin).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User list.
 */
router.get('/', requireRole('admin'), getAllUsers);

/**
 * 👤 Admin ODER User selbst: einzelnes Profil
 */
/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by id (admin or self).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User details.
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
/**
 * @openapi
 * /users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user by id (admin).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated user.
 */
router.put('/:id', requireRole('admin'), updateUserById);

/**
 * 🗑️ Admin ODER User selbst: löschen
 */
/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user by id (admin or self).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: User deleted.
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
