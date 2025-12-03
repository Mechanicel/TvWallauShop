// backend/src/routes/userRoutes.ts
// User-bezogene Routen (geschützt)

import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {deleteAccount, getMe, updateMe, updatePassword, updatePreferences} from "../controllers/userController";

const router = Router();

// Alle Routen geschützt
router.use(authMiddleware);

// Aktuellen User abrufen
router.get('/me', authMiddleware, getMe);

// Aktuellen User aktualisieren
router.put('/me', authMiddleware, updateMe);

// Admin: alle User sehen
router.get('/', requireRole('admin'), userController.getAllUsers);

// Admin ODER User selbst: einzelnes Profil
router.get('/:id', (req, res, next) => {
    const user = (req as any).user;
    if (user.role === 'admin' || user.id === Number(req.params.id)) {
        return userController.getUserById(req, res, next);
    }
    return res.status(403).json({ error: 'Forbidden' });
});

// 🔹 Admin: beliebigen User per ID aktualisieren
router.put('/:id', requireRole('admin'), userController.updateUserById);

// Account löschen (eigener Account)
router.delete('/me', authMiddleware, deleteAccount);

// Admin ODER User selbst: löschen
router.delete('/:id', (req, res, next) => {
    const user = (req as any).user;
    if (user.role === 'admin' || user.id === Number(req.params.id)) {
        return userController.deleteUser(req, res, next);
    }
    return res.status(403).json({ error: 'Forbidden' });
});

// Passwort ändern
router.put('/me/password', authMiddleware, updatePassword);

// Newsletter + Payment + weitere Präferenzen ändern
router.put('/me/preferences', authMiddleware, updatePreferences);

export default router;
