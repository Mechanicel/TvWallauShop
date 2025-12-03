// backend/src/routes/authRoutes.ts
// Authentifizierungs-Routen (public)

import { Router } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

// Öffentlich erreichbar (kein Token notwendig)
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/verify', authController.verifyEmail);
router.post('/resend', authController.resendVerification);

export default router;
