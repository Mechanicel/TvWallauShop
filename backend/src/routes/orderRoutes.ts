import { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Alle Order-Routen geschützt
router.use(authMiddleware);

// Alle Orders laden (Admin alle, Customer nur eigene → Logik im Service)
router.get('/', orderController.getOrders);

// ✅ eigene Orders
router.get('/me', orderController.getMyOrders);

// ✅ NEU: eigene Order stornieren (nur wenn noch nicht bezahlt)
router.post('/me/:id/cancel', orderController.cancelMyOrder);

// Einzelne Order → Service prüft Ownership/Admin anhand req.user
router.get('/:id', orderController.getOrderById);

// Order anlegen → Service setzt user_id korrekt anhand req.user
router.post('/', orderController.createOrder);

router.put('/:id/status', requireRole('admin'), orderController.updateOrderStatus);

// Order löschen → nur Admin
router.delete('/:id', requireRole('admin'), orderController.deleteOrder);

export default router;
