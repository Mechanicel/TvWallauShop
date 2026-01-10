import { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Alle Order-Routen geschützt
router.use(authMiddleware);

// Alle Orders laden (Admin alle, Customer nur eigene → Logik im Service)
/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders (admin or own orders).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order list.
 */
router.get('/', orderController.getOrders);

// ✅ eigene Orders
/**
 * @openapi
 * /orders/me:
 *   get:
 *     tags: [Orders]
 *     summary: List current user's orders.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user orders.
 */
router.get('/me', orderController.getMyOrders);

// ✅ NEU: eigene Order stornieren (nur wenn noch nicht bezahlt)
/**
 * @openapi
 * /orders/me/{id}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel a current user's order.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order cancelled.
 */
router.post('/me/:id/cancel', orderController.cancelMyOrder);

// Einzelne Order → Service prüft Ownership/Admin anhand req.user
/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order by id.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order details.
 */
router.get('/:id', orderController.getOrderById);

// Order anlegen → Service setzt user_id korrekt anhand req.user
/**
 * @openapi
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Create a new order.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Order created.
 */
router.post('/', orderController.createOrder);

/**
 * @openapi
 * /orders/{id}/status:
 *   put:
 *     tags: [Orders]
 *     summary: Update order status (admin).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Order status updated.
 */
router.put('/:id/status', requireRole('admin'), orderController.updateOrderStatus);

// Order löschen → nur Admin
/**
 * @openapi
 * /orders/{id}:
 *   delete:
 *     tags: [Orders]
 *     summary: Delete an order (admin).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Order deleted.
 */
router.delete('/:id', requireRole('admin'), orderController.deleteOrder);

export default router;
