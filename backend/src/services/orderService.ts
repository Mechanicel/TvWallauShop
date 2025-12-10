// backend/src/services/orderService.ts
import { knex } from '../database';
import {mapUser, restockOrderItems} from "../utils/helpers";
import {sendOrderConfirmationEmail} from "../utils/mailer";
import {InsufficientStockError} from "../errors/InsufficientStockError";

// ⚠️ DB nutzt snake_case, Services liefern camelCase.
// Struktur so, dass dein Frontend (ManageOrders.tsx) direkt damit arbeiten kann.

export interface Order {
    id: number;
    status: string;
    createdAt: Date;
    user: {
        id: number;
        email: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        role: 'customer' | 'admin';
        createdAt: Date;
    };
    items: OrderItem[];
    total: number;
}

export interface OrderItem {
    id: string; // synthetische ID: orderId-productId-sizeId
    orderId: number;
    productId: number;
    productName: string;
    sizeId: number;
    sizeLabel: string;
    quantity: number;
    price: number;
}

// Helper fürs Mapping eines Items
function mapOrderItem(row: any): OrderItem {
    return {
        id: `${row.order_id}-${row.product_id}-${row.size_id}`,
        orderId: row.order_id,
        productId: row.product_id,
        productName: row.product_name,
        sizeId: row.size_id,
        sizeLabel: row.size_label,
        quantity: row.quantity,
        price: Number(row.price),
    };
}

export const orderService = {
    // Alle Orders laden (Admin sieht alle, User nur eigene)
    async getOrders(user: { id: number; role: string }, query: any): Promise<Order[]> {
        let sql = knex('orders as o')
            .join('users as u', 'o.user_id', 'u.id')
            .select(
                'o.id as order_id',
                'o.status',
                'o.created_at as order_created_at',

                // User-Felder
                'u.id as user_id',
                'u.first_name',
                'u.last_name',
                'u.email',
                'u.phone',
                'u.role',
                'u.is_verified',
                'u.street',
                'u.house_number',
                'u.postal_code',
                'u.city',
                'u.state',
                'u.country',
                'u.shipping_street',
                'u.shipping_house_number',
                'u.shipping_postal_code',
                'u.shipping_city',
                'u.shipping_state',
                'u.shipping_country',
                'u.preferred_payment',
                'u.newsletter_opt_in',
                'u.date_of_birth',
                'u.gender',
                'u.created_at as user_created_at'
            );

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

        const itemRows = await knex('order_items as oi')
            .join('products as p', 'oi.product_id', 'p.id')
            .join('sizes as s', 'oi.size_id', 's.id')
            .select(
                'oi.order_id',
                'oi.product_id',
                'p.name as product_name',
                'oi.size_id',
                's.label as size_label',
                'oi.quantity',
                'oi.price'
            )
            .whereIn('oi.order_id', orderIds);

        return rows.map((r) => {
            const items = itemRows.filter((it) => it.order_id === r.order_id).map(mapOrderItem);
            const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

            return {
                id: r.order_id,
                status: r.status,
                createdAt: r.order_created_at,
                user: mapUser(r),
                items,
                total
            };
        });
    },

    async getOrderById(id: number, user: { id: number; role: string }): Promise<Order> {
        const orderRow = await knex('orders as o')
            .join('users as u', 'o.user_id', 'u.id')
            .select(
                'o.id as order_id',
                'o.status',
                'o.created_at as order_created_at',

                // User-Felder
                'u.id as user_id',
                'u.first_name',
                'u.last_name',
                'u.email',
                'u.phone',
                'u.role',
                'u.is_verified',
                'u.street',
                'u.house_number',
                'u.postal_code',
                'u.city',
                'u.state',
                'u.country',
                'u.shipping_street',
                'u.shipping_house_number',
                'u.shipping_postal_code',
                'u.shipping_city',
                'u.shipping_state',
                'u.shipping_country',
                'u.preferred_payment',
                'u.newsletter_opt_in',
                'u.date_of_birth',
                'u.gender',
                'u.created_at as user_created_at'
            )
            .where('o.id', id)
            .first();

        if (!orderRow) throw Object.assign(new Error('Order not found'), { status: 404 });

        if (user.role !== 'admin' && orderRow.user_id !== user.id) {
            throw Object.assign(new Error('Forbidden'), { status: 403 });
        }

        const itemRows = await knex('order_items as oi')
            .join('products as p', 'oi.product_id', 'p.id')
            .join('sizes as s', 'oi.size_id', 's.id')
            .select(
                'oi.order_id',
                'oi.product_id',
                'p.name as product_name',
                'oi.size_id',
                's.label as size_label',
                'oi.quantity',
                'oi.price'
            )
            .where('oi.order_id', id);

        const items = itemRows.map(mapOrderItem);
        const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

        return {
            id: orderRow.order_id,
            status: orderRow.status,
            createdAt: orderRow.order_created_at,
            user: mapUser(orderRow),
            items,
            total
        };
    },

    // Neue Order anlegen
    async createOrder(
        data: {
            userId?: number;
            status?: string;
            items: Array<{ productId: number; sizeId: number; quantity: number }>;
        },
        user: { id: number; role: string }
    ): Promise<Order> {
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw Object.assign(new Error('items are required'), { status: 400 });
        }

        const targetUserId =
            user.role === 'admin' && typeof data.userId === 'number'
                ? data.userId
                : user.id;

        const result = await knex.transaction(async (trx) => {
            // 1) Order anlegen
            const [orderId] = await trx('orders').insert({
                user_id: targetUserId,
                status: data.status || 'Bestellt',
            });

            // 2) Preise holen
            const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
            const products = await trx('products')
                .select('id', 'price', 'name')
                .whereIn('id', productIds);

            const priceMap = new Map<number, { price: number; name: string }>(
                products.map((p: any) => [
                    Number(p.id),
                    { price: Number(p.price), name: p.name },
                ])
            );

            // 3) Lagerbestand prüfen & reservieren
            //    -> wir aggregieren pro (productId, sizeId), damit Mehrfach-Einträge korrekt sind
            const aggregated = new Map<
                string,
                { productId: number; sizeId: number; quantity: number }
            >();

            for (const it of data.items) {
                const key = `${it.productId}-${it.sizeId}`;
                const existing = aggregated.get(key) || {
                    productId: it.productId,
                    sizeId: it.sizeId,
                    quantity: 0,
                };
                existing.quantity += it.quantity;
                aggregated.set(key, existing);
            }

            for (const { productId, sizeId, quantity } of aggregated.values()) {
                const stockRow = await trx('product_sizes')
                    .where({
                        product_id: productId,
                        size_id: sizeId,
                    })
                    .forUpdate()
                    .first();

                if (!stockRow) {
                    throw Object.assign(
                        new Error(
                            `Lagerbestand für Produkt ${productId}, Größe ${sizeId} nicht gefunden`
                        ),
                        { status: 400 }
                    );
                }

                const available = Number(stockRow.stock);
                if (available < quantity) {
                    // Intern genaue Details – nach außen zeigen wir die später NICHT 1:1
                    throw new InsufficientStockError(
                        productId,
                        sizeId ?? null,
                        available,
                        quantity
                    );
                }

                // Bestand reservieren (abziehen)
                await trx('product_sizes')
                    .where({
                        product_id: productId,
                        size_id: sizeId,
                    })
                    .decrement('stock', quantity);
            }

            // 4) Items vorbereiten & einfügen
            const rows = data.items.map((it) => {
                const prod = priceMap.get(it.productId);
                if (!prod) {
                    throw Object.assign(
                        new Error(`Product ${it.productId} not found`),
                        { status: 400 }
                    );
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

            // 5) Items inkl. Produktname + Größe laden
            const itemRows = await trx('order_items as oi')
                .join('products as p', 'oi.product_id', 'p.id')
                .join('sizes as s', 'oi.size_id', 's.id')
                .select(
                    'oi.order_id',
                    'oi.product_id',
                    'p.name as product_name',
                    'oi.size_id',
                    's.label as size_label',
                    'oi.quantity',
                    'oi.price'
                )
                .where('oi.order_id', orderId);

            const items = itemRows.map(mapOrderItem);
            const total = items.reduce(
                (sum, it) => sum + it.price * it.quantity,
                0
            );

            // 6) User-Daten laden
            const orderRow = await trx('orders as o')
                .join('users as u', 'o.user_id', 'u.id')
                .select(
                    'o.id as order_id',
                    'o.status',
                    'o.created_at as order_created_at',
                    'u.id as user_id',
                    'u.email',
                    'u.first_name',
                    'u.last_name',
                    'u.phone',
                    'u.role',
                    'u.created_at as user_created_at'
                )
                .where('o.id', orderId)
                .first();

            // 7) Mail verschicken (Fehler werden nur geloggt)
            try {
                await sendOrderConfirmationEmail({
                    to: orderRow.email,
                    firstName: orderRow.first_name,
                    orderId: orderRow.order_id,
                    items,
                    total,
                });
            } catch (mailErr) {
                console.error(
                    'Fehler beim Senden der Bestellbestätigung:',
                    mailErr
                );
            }

            return {
                id: orderRow.order_id,
                status: orderRow.status,
                createdAt: orderRow.order_created_at,
                user: {
                    id: orderRow.user_id,
                    email: orderRow.email,
                    firstName: orderRow.first_name,
                    lastName: orderRow.last_name,
                    phone: orderRow.phone,
                    role: orderRow.role,
                    createdAt: orderRow.user_created_at,
                },
                items,
                total,
            };
        });

        return result;
    },

    // Order löschen
    async deleteOrder(id: number): Promise<void> {
        const row = await knex('orders').where({ id }).first();
        if (!row) {
            throw Object.assign(new Error('Order not found'), { status: 404 });
        }

        await knex.transaction(async (trx) => {
            // Aktuellen Status im Lock lesen
            const current = await trx('orders')
                .where({ id })
                .forUpdate()
                .first();

            if (!current) {
                throw Object.assign(new Error('Order not found'), {
                    status: 404,
                });
            }

            // Nur dann restocken, wenn die Order NICHT bereits "Storniert" ist
            if (current.status !== 'Storniert') {
                await restockOrderItems(trx, id);
            }

            // Order + Items löschen (Items via FK / CASCADE oder explizit)
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
            const current = await trx('orders')
                .where({ id })
                .forUpdate()
                .first();

            if (!current) {
                throw Object.assign(new Error('Order not found'), {
                    status: 404,
                });
            }

            const oldStatus = current.status;
            const newStatus = status;

            // Nur bei Übergang -> "Storniert" restocken
            if (oldStatus !== 'Storniert' && newStatus === 'Storniert') {
                await restockOrderItems(trx, id);
            }

            // Status aktualisieren
            await trx('orders').where({ id }).update({ status: newStatus });
        });

        // Aktualisierte Order inkl. Items & User neu laden
        const updated = await knex('orders as o')
            .join('users as u', 'o.user_id', 'u.id')
            .select(
                'o.id as order_id',
                'o.status',
                'o.created_at as order_created_at',
                'u.id as user_id',
                'u.email',
                'u.first_name',
                'u.last_name',
                'u.phone',
                'u.role',
                'u.created_at as user_created_at'
            )
            .where('o.id', id)
            .first();

        const itemRows = await knex('order_items as oi')
            .join('products as p', 'oi.product_id', 'p.id')
            .join('sizes as s', 'oi.size_id', 's.id')
            .select(
                'oi.order_id',
                'oi.product_id',
                'p.name as product_name',
                'oi.size_id',
                's.label as size_label',
                'oi.quantity',
                'oi.price'
            )
            .where('oi.order_id', id);

        const items = itemRows.map(mapOrderItem);
        const total = items.reduce(
            (sum, it) => sum + it.price * it.quantity,
            0
        );

        return {
            id: updated.order_id,
            status: updated.status,
            createdAt: updated.order_created_at,
            user: {
                id: updated.user_id,
                email: updated.email,
                firstName: updated.first_name,
                lastName: updated.last_name,
                phone: updated.phone,
                role: updated.role,
                createdAt: updated.user_created_at,
            },
            items,
            total,
        };
    },

    async getOrdersByUser(userId: number) {
        console.log("TEST!!!!!!: " + userId);
        const rows = await knex('orders as o')
            .leftJoin('order_items as oi', 'o.id', 'oi.order_id')
            .leftJoin('products as p', 'oi.product_id', 'p.id')
            .leftJoin('sizes as s', 'oi.size_id', 's.id')
            .select(
                'o.id as order_id',
                'o.status',
                'o.created_at as order_created_at',
                'oi.quantity',
                'oi.price',
                'p.name as product_name',
                's.label as size_label'
            )
            .where('o.user_id', userId);

        const grouped: any = {};
        for (const row of rows) {
            if (!grouped[row.order_id]) {
                grouped[row.order_id] = {
                    id: row.order_id,
                    status: row.status,
                    createdAt: row.order_created_at,
                    items: [],
                    total: 0,
                };
            }
            if (row.product_name) {
                grouped[row.order_id].items.push({
                    productName: row.product_name,
                    sizeLabel: row.size_label,
                    quantity: row.quantity,
                    price: row.price,
                });
                grouped[row.order_id].total += row.price * row.quantity;
            }
        }
        return Object.values(grouped);
    }


};
