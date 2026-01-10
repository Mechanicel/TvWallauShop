// backend/src/services/orderService.ts
import { knex } from '../database';
import { sendOrderConfirmationEmail } from '../utils/mailer';
import type { Order, OrderItem, OrderSummary } from '@tvwallaushop/contracts';
import { OrderListQuery } from '../models/orderModel';
import { productService } from './productService';
import { userService, UserView } from './userService';
import type { Knex } from 'knex';

type OrderItemView = OrderItem & { orderId: number };

// Helper fürs Mapping eines Items
function mapOrderItem(row: {
    order_id: number;
    product_id: number;
    size_id: number;
    quantity: number;
    price: number | string;
}, productName: string, sizeLabel: string): OrderItemView {
    return {
        orderId: row.order_id,
        productId: row.product_id,
        productName,
        sizeId: row.size_id,
        sizeLabel,
        quantity: row.quantity,
        price: Number(row.price),
    };
}

function mapUserView(user: UserView): Order['user'] {
    return user;
}

async function buildOrderItems(
    rows: Array<{ order_id: number; product_id: number; size_id: number; quantity: number; price: number | string }>,
    db?: Knex | Knex.Transaction,
): Promise<OrderItemView[]> {
    if (rows.length === 0) return [];

    const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
    const sizeIds = Array.from(new Set(rows.map((row) => row.size_id)));

    const [productNames, sizeLabels] = await Promise.all([
        productService.getProductNamesByIds(productIds, db),
        productService.getSizeLabelsByIds(sizeIds, db),
    ]);

    return rows.map((row) => {
        const productName = productNames.get(row.product_id) ?? 'Unbekannt';
        const sizeLabel = sizeLabels.get(row.size_id) ?? 'Unbekannt';
        return mapOrderItem(row, productName, sizeLabel);
    });
}

async function restockOrderItems(
    trx: Knex.Transaction,
    orderId: number,
): Promise<void> {
    const items = await trx('order_items')
        .where({ order_id: orderId })
        .select<{ product_id: number; size_id: number; quantity: number }[]>('product_id', 'size_id', 'quantity');

    const restockPayload = items.map((item) => ({
        productId: item.product_id,
        sizeId: item.size_id,
        quantity: item.quantity,
    }));

    await productService.restockItems(restockPayload, trx);
}

// ✅ Helper: Order im "me"-Format laden (wie getOrdersByUser)
async function getOrderSummaryByUserAndId(userId: number, orderId: number): Promise<OrderSummary> {
    const orderRow = await knex('orders')
        .select('id', 'status', 'created_at')
        .where({ id: orderId, user_id: userId })
        .first();

    if (!orderRow) {
        throw Object.assign(new Error('Order not found'), { status: 404 });
    }

    const itemRows = await knex('order_items')
        .select('order_id', 'product_id', 'size_id', 'quantity', 'price')
        .where('order_id', orderId);

    const items = await buildOrderItems(itemRows);

    const grouped: OrderSummary = {
        id: orderRow.id,
        status: orderRow.status,
        createdAt: orderRow.created_at.toISOString(),
        items: items.map((item) => ({
            productName: item.productName,
            sizeLabel: item.sizeLabel,
            quantity: item.quantity,
            price: item.price,
        })),
        total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    };

    return grouped;
}

export const orderService = {
    // Alle Orders laden (Admin sieht alle, User nur eigene)
    async getOrders(user: { id: number; role: 'customer' | 'admin' }, query: OrderListQuery): Promise<Order[]> {
        let sql = knex('orders as o')
            .select('o.id as order_id', 'o.status', 'o.created_at as order_created_at', 'o.user_id');

        if (user.role === 'admin') {
            if (query.userId) {
                sql = sql.where('o.user_id', Number(query.userId));
            }
        } else {
            sql = sql.where('o.user_id', user.id);
        }

        const rows = await sql.orderBy('o.id', 'desc');
        const orderIds = rows.map((r) => r.order_id);
        if (orderIds.length === 0) return [];

        const [itemRows, users] = await Promise.all([
            knex('order_items')
                .select('order_id', 'product_id', 'size_id', 'quantity', 'price')
                .whereIn('order_id', orderIds),
            userService.getUsersByIds(Array.from(new Set(rows.map((row) => row.user_id)))),
        ]);

        const items = await buildOrderItems(itemRows);
        const itemsByOrder = new Map<number, OrderItem[]>();
        for (const item of items) {
            const current = itemsByOrder.get(item.orderId) ?? [];
            current.push({
                productId: item.productId,
                productName: item.productName,
                sizeId: item.sizeId,
                sizeLabel: item.sizeLabel,
                quantity: item.quantity,
                price: item.price,
            });
            itemsByOrder.set(item.orderId, current);
        }

        const usersById = new Map(users.map((u) => [u.id, u]));

        return rows.map((row) => {
            const orderItems = itemsByOrder.get(row.order_id) ?? [];
            const total = orderItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
            const userView = usersById.get(row.user_id);

            return {
                id: row.order_id,
                status: row.status,
                createdAt: row.order_created_at.toISOString(),
                user: userView
                    ? mapUserView(userView)
                    : {
                        id: row.user_id,
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: null,
                        role: user.role,
                        isVerified: false,
                        createdAt: row.order_created_at.toISOString(),
                        street: null,
                        houseNumber: null,
                        postalCode: null,
                        city: null,
                        state: null,
                        country: null,
                        shippingStreet: null,
                        shippingHouseNumber: null,
                        shippingPostalCode: null,
                        shippingCity: null,
                        shippingState: null,
                        shippingCountry: null,
                        preferredPayment: 'invoice',
                        newsletterOptIn: false,
                        dateOfBirth: null,
                        gender: null,
                        loyaltyPoints: 0,
                        lastLogin: null,
                        accountStatus: 'active',
                    },
                items: orderItems,
                total,
            };
        });
    },

    async getOrderById(id: number, user: { id: number; role: string }): Promise<Order> {
        const orderRow = await knex('orders as o')
            .select('o.id as order_id', 'o.status', 'o.created_at as order_created_at', 'o.user_id')
            .where('o.id', id)
            .first();

        if (!orderRow) throw Object.assign(new Error('Order not found'), { status: 404 });

        if (user.role !== 'admin' && orderRow.user_id !== user.id) {
            throw Object.assign(new Error('Forbidden'), { status: 403 });
        }

        const [itemRows, userView] = await Promise.all([
            knex('order_items')
                .select('order_id', 'product_id', 'size_id', 'quantity', 'price')
                .where('order_id', id),
            userService.getUserById(orderRow.user_id),
        ]);

        const items = await buildOrderItems(itemRows);
        const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

        return {
            id: orderRow.order_id,
            status: orderRow.status,
            createdAt: orderRow.order_created_at.toISOString(),
            user: mapUserView(userView),
            items: items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                sizeId: item.sizeId,
                sizeLabel: item.sizeLabel,
                quantity: item.quantity,
                price: item.price,
            })),
            total,
        };
    },

    // Neue Order anlegen
    async createOrder(
        data: {
            userId?: number;
            status?: string;
            items: Array<{ productId: number; sizeId: number; quantity: number }>;
        },
        user: { id: number; role: string },
    ): Promise<Order> {
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw Object.assign(new Error('items are required'), { status: 400 });
        }

        const targetUserId = user.role === 'admin' && typeof data.userId === 'number' ? data.userId : user.id;

        return await knex.transaction(async (trx) => {
            const [orderId] = await trx('orders').insert({
                user_id: targetUserId,
                status: data.status || 'Bestellt',
            });

            const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
            const priceMap = await productService.getProductPricingByIds(productIds, trx);

            const aggregated = new Map<string, { productId: number; sizeId: number; quantity: number }>();

            for (const it of data.items) {
                const key = `${it.productId}-${it.sizeId}`;
                const existing = aggregated.get(key) || { productId: it.productId, sizeId: it.sizeId, quantity: 0 };
                existing.quantity += it.quantity;
                aggregated.set(key, existing);
            }

            await productService.reserveStock(
                Array.from(aggregated.values()),
                trx,
            );

            const rows = data.items.map((it) => {
                const prod = priceMap.get(it.productId);
                if (!prod) {
                    throw Object.assign(new Error(`Product ${it.productId} not found`), { status: 400 });
                }
                return {
                    order_id: orderId,
                    product_id: it.productId,
                    size_id: it.sizeId,
                    quantity: it.quantity,
                    price: prod.price,
                };
            });

            await trx('order_items').insert(rows);

            const itemRows = await trx('order_items')
                .select('order_id', 'product_id', 'size_id', 'quantity', 'price')
                .where('order_id', orderId);

            const items = await buildOrderItems(itemRows, trx);
            const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

            const [orderRow, userView] = await Promise.all([
                trx('orders')
                    .select('id', 'status', 'created_at', 'user_id')
                    .where('id', orderId)
                    .first(),
                userService.getUserById(targetUserId, trx),
            ]);

            try {
                await sendOrderConfirmationEmail({
                    to: userView.email,
                    firstName: userView.firstName,
                    orderId: orderRow.id,
                    items,
                    total,
                });
            } catch (mailErr) {
                console.error('Fehler beim Senden der Bestellbestätigung:', mailErr);
            }

            return {
                id: orderRow.id,
                status: orderRow.status,
                createdAt: orderRow.created_at.toISOString(),
                user: mapUserView(userView),
                items: items.map((item) => ({
                    productId: item.productId,
                    productName: item.productName,
                    sizeId: item.sizeId,
                    sizeLabel: item.sizeLabel,
                    quantity: item.quantity,
                    price: item.price,
                })),
                total,
            };
        });
    },

    // Order löschen
    async deleteOrder(id: number): Promise<void> {
        const row = await knex('orders').where({ id }).first();
        if (!row) {
            throw Object.assign(new Error('Order not found'), { status: 404 });
        }

        await knex.transaction(async (trx) => {
            const current = await trx('orders').where({ id }).forUpdate().first();

            if (!current) {
                throw Object.assign(new Error('Order not found'), { status: 404 });
            }

            if (current.status !== 'Storniert') {
                await restockOrderItems(trx, id);
            }

            await trx('order_items').where({ order_id: id }).del();
            await trx('orders').where({ id }).del();
        });
    },

    // Order-Status ändern
    async updateOrderStatus(id: number, status: string): Promise<Order> {
        const existing = await knex('orders').where({ id }).first();
        if (!existing) {
            throw Object.assign(new Error('Order not found'), { status: 404 });
        }

        await knex.transaction(async (trx) => {
            const current = await trx('orders').where({ id }).forUpdate().first();

            if (!current) {
                throw Object.assign(new Error('Order not found'), { status: 404 });
            }

            const oldStatus = current.status;
            const newStatus = status;

            if (oldStatus !== 'Storniert' && newStatus === 'Storniert') {
                await restockOrderItems(trx, id);
            }

            await trx('orders').where({ id }).update({ status: newStatus });
        });

        const [updated, itemRows, userView] = await Promise.all([
            knex('orders')
                .select('id', 'status', 'created_at', 'user_id')
                .where('id', id)
                .first(),
            knex('order_items')
                .select('order_id', 'product_id', 'size_id', 'quantity', 'price')
                .where('order_id', id),
            userService.getUserById(existing.user_id),
        ]);

        const items = await buildOrderItems(itemRows);
        const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

        return {
            id: updated.id,
            status: updated.status,
            createdAt: updated.created_at.toISOString(),
            user: mapUserView(userView),
            items: items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                sizeId: item.sizeId,
                sizeLabel: item.sizeLabel,
                quantity: item.quantity,
                price: item.price,
            })),
            total,
        };
    },

    // ✅ NEU: User cancelt eigene Order (nur Status "Bestellt")
    async cancelMyOrder(orderId: number, userId: number): Promise<OrderSummary> {
        await knex.transaction(async (trx) => {
            const current = await trx('orders')
                .where({ id: orderId })
                .forUpdate()
                .first();

            if (!current) {
                throw Object.assign(new Error('Order not found'), { status: 404 });
            }

            if (Number(current.user_id) !== Number(userId)) {
                throw Object.assign(new Error('Forbidden'), { status: 403 });
            }

            // idempotent: wenn schon storniert → OK
            if (current.status === 'Storniert') {
                return;
            }

            // nur "Bestellt" darf der User stornieren
            if (current.status !== 'Bestellt') {
                // "Bezahlt" / "Versendet" / etc.
                throw Object.assign(new Error('Order kann nicht storniert werden'), { status: 409 });
            }

            // Restock + Status auf Storniert
            await restockOrderItems(trx, orderId);
            await trx('orders').where({ id: orderId }).update({ status: 'Storniert' });
        });

        // Antwort im gleichen Format wie GET /orders/me
        return await getOrderSummaryByUserAndId(userId, orderId);
    },

    async getOrdersByUser(userId: number): Promise<OrderSummary[]> {
        const orderRows = await knex('orders')
            .select('id', 'status', 'created_at')
            .where('user_id', userId);

        if (orderRows.length === 0) return [];

        const orderIds = orderRows.map((row) => row.id);
        const itemRows = await knex('order_items')
            .select('order_id', 'product_id', 'size_id', 'quantity', 'price')
            .whereIn('order_id', orderIds);

        const items = await buildOrderItems(itemRows);

        const grouped: Record<number, OrderSummary> = {};

        for (const order of orderRows) {
            grouped[order.id] = {
                id: order.id,
                status: order.status,
                createdAt: order.created_at.toISOString(),
                items: [],
                total: 0,
            };
        }

        for (const item of items) {
            const entry = grouped[item.orderId];
            if (!entry) continue;
            entry.items.push({
                productName: item.productName,
                sizeLabel: item.sizeLabel,
                quantity: item.quantity,
                price: item.price,
            });
            entry.total += item.price * item.quantity;
        }

        return Object.values(grouped);
    },
};
