import express from 'express';
import path from 'path';
import aiRoutes from '../../routes/aiRoutes';

export const aiServiceApp = express.Router();
export const aiUploadsRouter = express.Router();

aiServiceApp.use('/ai', aiRoutes);

const uploadsPath = path.join(__dirname, '..', '..', '..', 'uploads');
aiUploadsRouter.use(express.static(uploadsPath));
