// backend/src/controllers/userController.ts
import { Request, Response } from 'express';
import { userService, UserView } from '../services/userService';
import { catchAsync } from '../utils/helpers';
import { ServiceError } from '../errors/ServiceError';

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
export const getMe = catchAsync(async (req: Request, res: Response) => {
    const currentUser = (req as any).user;
    if (!currentUser) {
        throw new ServiceError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const user = await userService.getUserById(currentUser.id);
    res.json(user);
});

// PUT /api/users/me
export const updateMe = catchAsync(async (req: Request, res: Response) => {
    const currentUser = (req as any).user;
    if (!currentUser) {
        throw new ServiceError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const updates = req.body;

    const updated = await userService.updateUser(currentUser.id, updates);
    res.json(updated);
});

export const updatePassword = catchAsync(async (req: Request, res: Response) => {
    const currentUser = (req as any).user;
    if (!currentUser) {
        throw new ServiceError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const { oldPassword, newPassword } = req.body;

    await userService.changePassword(currentUser.id, oldPassword, newPassword);

    res.json({ message: 'Passwort erfolgreich geändert' });
});

export const updatePreferences = catchAsync(async (req: Request, res: Response) => {
    const currentUser = (req as any).user;
    if (!currentUser) {
        throw new ServiceError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const { newsletterOptIn, preferredPayment } = req.body;

    const updated = await userService.updatePreferences(currentUser.id, {
        newsletterOptIn,
        preferredPayment,
    });

    res.json({ message: 'Einstellungen gespeichert', user: updated });
});

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
    const requester = (req as any).user; // eingeloggter User
    if (!requester) {
        throw new ServiceError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const targetId = req.params.id ? Number(req.params.id) : requester.id;

    if (req.params.id && requester.role !== 'admin') {
        throw new ServiceError(
            'Nur Admins dürfen andere Accounts löschen',
            403,
            'FORBIDDEN'
        );
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
});
export const updateUserById = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
        throw new ServiceError('Ungültige User-ID', 400, 'INVALID_USER_ID');
    }

    const updates = req.body;

    const updatedUser: UserView = await userService.updateUser(id, updates);
    return res.status(200).json(updatedUser);
});
