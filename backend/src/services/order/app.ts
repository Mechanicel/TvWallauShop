import express from 'express';
import orderRoutes from '../../routes/orderRoutes';

export const orderServiceApp = express.Router();

orderServiceApp.use('/orders', orderRoutes);
