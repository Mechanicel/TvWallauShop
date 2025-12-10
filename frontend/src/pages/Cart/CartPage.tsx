// frontend/src/pages/Cart/CartPage.tsx

import React from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { removeFromCart, updateQuantity } from '@/store/slices/cartSlice';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '@/utils/imageUrl';
import './CartPage.css';

// Typ aus cartSlice – erweitert um imageUrl & sizeLabel
type CartItem = {
  productId: number;
  sizeId: number | null;
  sizeLabel?: string | null;
  name: string;
  price: number | string;
  quantity: number;
  imageUrl?: string | null;
};

export const CartPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const cartItems = useAppSelector((state) => state.cart.items) as CartItem[];

  const handleQuantityChange = (item: CartItem, value: number) => {
    dispatch(
      updateQuantity({
        productId: item.productId,
        sizeId: item.sizeId ?? null,
        quantity: value,
      }),
    );
  };

  const handleRemove = (item: CartItem) => {
    dispatch(
      removeFromCart({
        productId: item.productId,
        sizeId: item.sizeId ?? null,
      }),
    );
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  const footer = (
    <div className="cart-footer">
      <h3 className="cart-footer-total">Total: {totalPrice.toFixed(2)} €</h3>
      <Button
        label="Zur Kasse"
        icon="pi pi-credit-card"
        onClick={() => navigate('/cart/checkout')}
        disabled={cartItems.length === 0}
        className="cart-footer-button"
      />
    </div>
  );

  return (
    <div className="cart-page">
      <h2>Warenkorb</h2>

      {cartItems.length > 0 ? (
        <DataTable
          value={cartItems}
          footer={footer}
          responsiveLayout="scroll"
          className="cart-table p-datatable-sm"
        >
          {/* 🖼️ Bild */}
          <Column
            header="Bild"
            body={(item: CartItem) => {
              const img = item.imageUrl
                ? resolveImageUrl(item.imageUrl)
                : undefined;

              return img ? (
                <img src={img} alt={item.name} className="cart-table-image" />
              ) : (
                <span className="cart-table-image-placeholder">kein Bild</span>
              );
            }}
          />

          {/* Produktname */}
          <Column field="name" header="Produkt" />

          {/* Größe */}
          <Column
            field="sizeLabel"
            header="Größe"
            body={(item: CartItem) => (item.sizeLabel ? item.sizeLabel : '-')}
          />

          {/* Preis */}
          <Column
            header="Preis (€)"
            body={(item: CartItem) => Number(item.price).toFixed(2)}
          />

          {/* Menge */}
          <Column
            header="Menge"
            body={(item: CartItem) => (
              <InputNumber
                value={item.quantity}
                onValueChange={(e) => handleQuantityChange(item, e.value || 0)}
                min={1}
                showButtons
                buttonLayout="horizontal"
                decrementButtonClassName="p-button-text"
                incrementButtonClassName="p-button-text"
              />
            )}
          />

          {/* Entfernen */}
          <Column
            header="Entfernen"
            body={(item: CartItem) => (
              <Button
                icon="pi pi-trash"
                className="p-button-icon-only p-button-danger"
                onClick={() => handleRemove(item)}
              />
            )}
          />
        </DataTable>
      ) : (
        <p>Ihr Warenkorb ist leer.</p>
      )}
    </div>
  );
};
