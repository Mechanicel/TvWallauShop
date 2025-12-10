// frontend/src/pages/Cart/CheckoutPage.tsx

import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { useNavigate } from 'react-router-dom';
import { clearCart } from '@/store/slices/cartSlice';
import { placeOrder } from '@/store/slices/orderSlice';
import type { AxiosError } from 'axios';
import { isAxiosError } from 'axios';
import type { PlaceOrderPayload } from '@/services/orderService';
import { resolveImageUrl } from '@/utils/imageUrl';
import './CheckoutPage.css';

type CartItem = {
  productId: number;
  sizeId?: number | null;
  sizeLabel?: string | null;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

type InsufficientItemKey = {
  productId: number;
  sizeId: number | null;
};

const normalizeId = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

export const CheckoutPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const cartItems = useAppSelector((state) => state.cart.items) as CartItem[];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientItems, setInsufficientItems] = useState<InsufficientItemKey[]>([]);

  const totalPrice = cartItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
  );

  const isItemInsufficient = (item: CartItem): boolean =>
      insufficientItems.some(
          (ins) =>
              normalizeId(ins.productId) === normalizeId(item.productId) &&
              normalizeId(ins.sizeId) === normalizeId(item.sizeId),
      );

  const buildErrorMessage = (err: unknown): string => {
    const fallback =
        'Die Bestellung konnte nicht abgeschlossen werden. Bitte versuche es später erneut.';

    const anyErr = err as any;

    if (anyErr && typeof anyErr === 'object' && anyErr.code === 'INSUFFICIENT_STOCK') {
      return (
          anyErr.message ||
          'Ein Artikel ist nicht mehr in der gewünschten Menge verfügbar. Bitte prüfe deinen Warenkorb und passe die Mengen an.'
      );
    }

    if (isAxiosError(err)) {
      const axiosErr = err as AxiosError<any>;
      const status = axiosErr.response?.status;
      const data = axiosErr.response?.data as
          | { code?: string; message?: string }
          | undefined;

      if (data?.code === 'INSUFFICIENT_STOCK') {
        return (
            data.message ||
            'Ein Artikel ist nicht mehr in der gewünschten Menge verfügbar. Bitte prüfe deinen Warenkorb und passe die Mengen an.'
        );
      }

      if (axiosErr.code === 'ERR_NETWORK') {
        return 'Es konnte keine Verbindung zum Server hergestellt werden. Bitte überprüfe deine Internetverbindung.';
      }

      if (status && status >= 500) {
        return 'Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es später erneut.';
      }

      if (status === 400 && data?.message) {
        return data.message;
      }

      if (axiosErr.message) {
        return axiosErr.message;
      }

      return fallback;
    }

    if (anyErr && typeof anyErr === 'object' && typeof anyErr.message === 'string') {
      return anyErr.message;
    }

    if (err instanceof Error && err.message) {
      return err.message;
    }

    return fallback;
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      setError('Dein Warenkorb ist leer.');
      return;
    }

    setLoading(true);
    setError(null);
    setInsufficientItems([]);

    const payload: PlaceOrderPayload = {
      name,
      email,
      address,
      items: cartItems.map((item) => ({
        productId: item.productId,
        sizeId: item.sizeId ?? undefined,
        quantity: item.quantity,
        price: item.price,
      })),
    };

    try {
      if (import.meta.env.MODE === 'development') {
        console.log('[CheckoutPage] placeOrder payload:', payload);
      }

      await dispatch(placeOrder(payload)).unwrap();
      dispatch(clearCart());
      navigate('/order-confirmation');
    } catch (err: unknown) {
      const anyErr = err as any;

      const detailsFromError =
          anyErr?.details ??
          (isAxiosError(err) ? (err as AxiosError<any>).response?.data?.details : undefined);

      if (
          (anyErr && typeof anyErr === 'object' && anyErr.code === 'INSUFFICIENT_STOCK') ||
          (isAxiosError(err) &&
              (err as AxiosError<any>).response?.data?.code === 'INSUFFICIENT_STOCK')
      ) {
        if (detailsFromError) {
          const list = Array.isArray(detailsFromError)
              ? detailsFromError
              : [detailsFromError];

          const keys: InsufficientItemKey[] = list.map((d: any) => ({
            productId: normalizeId(d.productId) ?? -1,
            sizeId: normalizeId(d.sizeId),
          }));

          setInsufficientItems(keys);
        }
      }

      if (import.meta.env.MODE === 'development') {
        const axiosErr = isAxiosError(err) ? (err as AxiosError<any>) : null;
        const data = axiosErr?.response?.data as any | undefined;

        console.error('[CheckoutPage] placeOrder ERROR', {
          raw: err,
          code: anyErr?.code ?? data?.code,
          message: anyErr?.message ?? data?.message,
          details: detailsFromError,
          status: axiosErr?.response?.status,
        });
      }

      const msg = buildErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="checkout-page">
        <div className="checkout-wrapper">
          {/* Warenkorb-Übersicht */}
          <Card title="Bestellübersicht" className="p-mb-4 checkout-card-items">
            {cartItems.length > 0 && (
                <>
                  <div className="checkout-items-header">
                    <span className="checkout-items-header-col--article">Artikel</span>
                    <span className="checkout-items-header-col--details">Details</span>
                    <span className="checkout-items-header-col--price">Preis</span>
                  </div>

                  <div className="checkout-items-list">
                    {cartItems.map((item) => {
                      const insufficient = isItemInsufficient(item);
                      const imageSrc =
                          item.imageUrl && typeof item.imageUrl === 'string'
                              ? resolveImageUrl(item.imageUrl)
                              : undefined;

                      const linePrice = Number(item.price) * item.quantity;

                      return (
                          <div
                              key={`${normalizeId(item.productId)}-${normalizeId(item.sizeId)}`}
                              className={
                                  'checkout-order-item' +
                                  (insufficient ? ' checkout-order-item--insufficient' : '')
                              }
                          >
                            {/* Bild / Artikel-Spalte */}
                            <div className="checkout-order-item-image">
                              {imageSrc && (
                                  <img src={imageSrc} alt={item.name} />
                              )}
                            </div>

                            {/* Details-Spalte */}
                            <div className="checkout-order-item-info">
                              <span className="checkout-order-item-name">{item.name}</span>

                              <span className="checkout-order-item-meta">
                          {item.sizeLabel && <>Größe: {item.sizeLabel} &nbsp;|&nbsp; </>}
                                Menge: {item.quantity}
                        </span>

                              {insufficient && (
                                  <span className="checkout-order-item-warning">
                            Nicht genug Bestand – bitte Menge anpassen.
                          </span>
                              )}
                            </div>

                            {/* Preis-Spalte */}
                            <div className="checkout-order-item-price">
                        <span className="checkout-order-item-price-total">
                          {linePrice.toFixed(2)} €
                        </span>
                              <span className="checkout-order-item-price-unit">
                          ({Number(item.price).toFixed(2)} € / Stk.)
                        </span>
                            </div>
                          </div>
                      );
                    })}
                  </div>
                </>
            )}

            <div className="checkout-summary-row">
              <span>Summe:</span>
              <span>{totalPrice.toFixed(2)} €</span>
            </div>
          </Card>

          {/* Abhol-Infos */}
          <Card title="Abholer-Informationen">
            <div className="p-fluid">
              <div className="p-field">
                <label htmlFor="name">Name</label>
                <InputText
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
              </div>

              <div className="p-field">
                <label htmlFor="email">E-Mail</label>
                <InputText
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
              </div>

              <div className="p-field">
                <label htmlFor="address">Adresse</label>
                <InputText
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                />
              </div>

              {error && (
                  <div className="p-mt-2">
                    <p className="p-text-danger" style={{ whiteSpace: 'pre-line' }}>
                      {error}
                    </p>
                  </div>
              )}

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
