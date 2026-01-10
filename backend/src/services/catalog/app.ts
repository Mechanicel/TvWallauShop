import express from 'express';
import productRoutes from '../../routes/productRoutes';

export const catalogServiceApp = express.Router();

catalogServiceApp.use('/products', productRoutes);
