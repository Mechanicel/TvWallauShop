// backend/src/controllers/userController.ts
import { Request, Response } from 'express';
import { userService, UserView } from '../services/userService';
import { catchAsync } from '../utils/helpers';

// ✅ Alle User holen (Admin)
export const getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const users: UserView[] = await userService.getAllUsers();
    res.status(200).json(users);
});

// ✅ Einzelnen User holen (Admin oder Self – Route schützt)
export const getUserById = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const user: UserView = await userService.getUserById(id);
    res.status(200).json(user);
});

// ✅ User löschen (Admin oder Self – Route schützt)
export const deleteUser = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await userService.deleteUser(id);
    res.status(204).send();
});

// GET /api/users/me
export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const user = await userService.getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err: any) {
        console.error('[getMe] Fehler:', err);
        res.status(500).json({ error: 'Serverfehler' });
    }
};

// PUT /api/users/me
export const updateMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const updates = req.body;

        const updated = await userService.updateUser(userId, updates);
        res.json(updated);
    } catch (err: any) {
        console.error('[updateMe] Fehler:', err);
        res.status(500).json({ error: 'Update fehlgeschlagen' });
    }
};
export const updatePassword = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { oldPassword, newPassword } = req.body;

        const success = await userService.changePassword(userId, oldPassword, newPassword);
        if (!success) {
            return res.status(400).json({ error: 'Altes Passwort falsch' });
        }

        res.json({ message: 'Passwort erfolgreich geändert' });
    } catch (err) {
        console.error('[updatePassword]', err);
        res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
    }
};

export const updatePreferences = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { newsletterOptIn, preferredPayment } = req.body;

        const updated = await userService.updatePreferences(userId, {
            newsletterOptIn,
            preferredPayment,
        });

        res.json({ message: 'Einstellungen gespeichert', user: updated });
    } catch (err) {
        console.error('[updatePreferences]', err);
        res.status(500).json({ error: 'Fehler beim Speichern der Einstellungen' });
    }
};

export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const requester = (req as any).user; // eingeloggter User
        const targetId = req.params.id ? Number(req.params.id) : requester.id;

        if (req.params.id && requester.role !== 'admin') {
            return res.status(403).json({ error: 'Nur Admins dürfen andere Accounts löschen' });
        }

        // Tokens + User löschen
        await userService.deleteUserTokens(targetId);
        await userService.deleteUser(targetId);

        if (!req.params.id) {
            // Kunde löscht sich selbst → Cookies invalidieren
            res.clearCookie('accessToken', {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
            });
            res.clearCookie('refreshToken', {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
            });

        }

        return res.json({
            message: req.params.id
                ? `User ${targetId} wurde gelöscht`
                : 'Dein Account wurde gelöscht',
        });
    } catch (err) {
        console.error('[deleteAccount]', err);
        res.status(500).json({ error: 'Fehler beim Löschen des Accounts' });
    }
};
export const updateUserById = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
        return res.status(400).json({ error: 'Ungültige User-ID' });
    }

    const updates = req.body;

    const updatedUser: UserView = await userService.updateUser(id, updates);
    return res.status(200).json(updatedUser);
});
