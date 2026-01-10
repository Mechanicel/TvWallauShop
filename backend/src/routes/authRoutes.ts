// backend/src/routes/authRoutes.ts
// Authentifizierungs-Routen (public)

import { Router } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

// Öffentlich erreichbar (kein Token notwendig)
/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new user account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: User created.
 */
router.post('/signup', authController.signup);
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate a user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Login successful.
 */
router.post('/login', authController.login);
/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh auth tokens.
 *     responses:
 *       200:
 *         description: Tokens refreshed.
 */
router.post('/refresh', authController.refresh);
/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current session.
 *     responses:
 *       200:
 *         description: Logged out.
 */
router.post('/logout', authController.logout);
/**
 * @openapi
 * /auth/verify:
 *   get:
 *     tags: [Auth]
 *     summary: Verify email address.
 *     responses:
 *       200:
 *         description: Email verified.
 */
router.get('/verify', authController.verifyEmail);
/**
 * @openapi
 * /auth/resend:
 *   post:
 *     tags: [Auth]
 *     summary: Resend verification email.
 *     responses:
 *       200:
 *         description: Verification resent.
 */
router.post('/resend', authController.resendVerification);

export default router;
