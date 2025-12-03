import { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {getMyOrders} from "../controllers/orderController";

const router = Router();

// Alle Order-Routen geschützt
router.use(authMiddleware);

// User darf nur eigene Orders sehen → Logik ist im Service
router.get('/', orderController.getOrders);

router.get('/me', authMiddleware, getMyOrders);

// Einzelne Order → Service prüft Ownership/Admin anhand req.user
router.get('/:id', orderController.getOrderById);

// Order anlegen → Service setzt user_id korrekt anhand req.user
router.post('/', orderController.createOrder);

router.put('/:id/status', requireRole('admin'), orderController.updateOrderStatus);


// Order löschen → nur Admin (per Middleware)
router.delete('/:id', requireRole('admin'), orderController.deleteOrder);



export default router;
