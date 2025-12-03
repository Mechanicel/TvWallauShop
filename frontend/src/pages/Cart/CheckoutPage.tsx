// frontend/src/pages/Cart/CheckoutPage.tsx

import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { InputText } from 'primereact/inputtext';
import { Button }    from 'primereact/button';
import { Card }      from 'primereact/card';
import { useNavigate } from 'react-router-dom';
import { clearCart }   from '../../store/slices/cartSlice';
import { placeOrder }  from '../../store/slices/orderSlice';
import type { PlaceOrderPayload } from '../../services/orderService';

export const CheckoutPage: React.FC = () => {
    const dispatch  = useAppDispatch();
    const navigate  = useNavigate();
    const cartItems = useAppSelector(state => state.cart.items);

    const [name, setName]       = useState('');
    const [email, setEmail]     = useState('');
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const totalPrice = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    const handlePlaceOrder = async () => {
        if (cartItems.length === 0) {
            setError('Dein Warenkorb ist leer.');
            return;
        }
        setLoading(true);
        setError(null);

        // Wir wandeln sizeId: null → undefined, damit es zum OrderItemPayload passt
        const payload: PlaceOrderPayload = {
            name,
            email,
            address,
            items: cartItems.map(item => ({
                productId: item.productId,
                quantity:  item.quantity,
                price:     item.price,
                sizeId:    item.sizeId ?? undefined
            }))
        };

        try {
            console.log('[CheckoutPage] placeOrder mit:', payload);
            await dispatch(placeOrder(payload)).unwrap();
            dispatch(clearCart());
            navigate('/order-confirmation');
        } catch (err: any) {
            setError(err || 'Fehler beim Abschicken der Bestellung.');
            console.error('[CheckoutPage] placeOrder Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-grid p-justify-center p-p-4">
            <div className="p-col-12 p-md-8">
                <Card title="Bestellübersicht" className="p-mb-4">
                    {cartItems.map(item => (
                        <div key={`${item.productId}-${item.sizeId}`} className="p-d-flex p-ai-center p-mb-2">
                            <div className="p-flex-grow-1">
                                {item.name} x {item.quantity}
                            </div>
                            <div>{(item.price * item.quantity).toFixed(2)} €</div>
                        </div>
                    ))}
                    <hr />
                    <div className="p-d-flex p-jc-between p-text-bold">
                        <span>Summe:</span>
                        <span>{totalPrice.toFixed(2)} €</span>
                    </div>
                </Card>

                <Card title="Abholer-Informationen">
                    <div className="p-fluid">
                        <div className="p-field">
                            <label htmlFor="name">Name</label>
                            <InputText
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="p-field">
                            <label htmlFor="email">E-Mail</label>
                            <InputText
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="p-field">
                            <label htmlFor="address">Adresse</label>
                            <InputText
                                id="address"
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                required
                            />
                        </div>
                        {error && <p className="p-text-danger p-mt-2">{error}</p>}
                        <Button
                            label="Bestellung abschicken"
                            icon="pi pi-check"
                            onClick={handlePlaceOrder}
                            loading={loading}
                            disabled={loading}
                            className="p-mt-3"
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
};
