import express from 'express';
import authRoutes from '../../routes/authRoutes';
import userRoutes from '../../routes/userRoutes';

export const authServiceApp = express.Router();

authServiceApp.use('/auth', authRoutes);
authServiceApp.use('/users', userRoutes);
