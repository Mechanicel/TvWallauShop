import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/helpers';
import { orderService } from '../services/orderService';

// GET /api/orders
export const getOrders = catchAsync(async (req: Request, res: Response) => {
    const authUser = (req as any).user;
    const orders = await orderService.getOrders(authUser, req.query);
    res.status(200).json(orders);
});

export const updateOrderStatus = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    const order = await orderService.updateOrderStatus(id, status);
    res.status(200).json(order);
});


// GET /api/orders/:id
export const getOrderById = catchAsync(async (
    req: Request,
    res: Response,
    _next?: NextFunction,
    routeUser?: { id: number; role: 'admin' | 'customer' }
) => {
    const authUser = routeUser ?? (req as any).user;
    const order = await orderService.getOrderById(Number(req.params.id), authUser);
    res.status(200).json(order);
});

// POST /api/orders
export const createOrder = catchAsync(async (req: Request, res: Response) => {
    const authUser = (req as any).user;
    const order = await orderService.createOrder(req.body, authUser);
    res.status(201).json(order);
});

// DELETE /api/orders/:id
export const deleteOrder = catchAsync(async (req: Request, res: Response) => {
    await orderService.deleteOrder(Number(req.params.id));
    res.sendStatus(204);
});
export const getMyOrders = async (req: Request, res: Response) => {
    console.log("TEST!!!!");
    try {
        const userId = (req as any).user.id;
        console.log('[getMyOrders] userId:', (req as any).user?.id);
        const orders = await orderService.getOrdersByUser(userId);
        res.json(orders);
    } catch (err: any) {
        console.error('[getMyOrders]', err);
        res.status(500).json({ error: 'Fehler beim Laden der Bestellungen' });
    }
};