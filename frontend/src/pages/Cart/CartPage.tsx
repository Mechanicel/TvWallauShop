// frontend/src/pages/Cart/CartPage.tsx

import React from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { removeFromCart, updateQuantity } from '../../store/slices/cartSlice';
import { useNavigate } from 'react-router-dom';

export const CartPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const cartItems = useAppSelector((state) => state.cart.items);

  // Handler zum Anpassen der Menge
  const handleQuantityChange = (productId: number, value: number) => {
    dispatch(updateQuantity({ productId, quantity: value }));
  };

  // Handler zum Entfernen eines Artikels
  const handleRemove = (productId: number) => {
    dispatch(removeFromCart(productId));
  };

  // Gesamtpreis berechnen, dabei Price ggf. als String casten
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  // Footer mit Gesamtpreis und Checkout-Button
  const footer = (
    <div className="p-d-flex p-jc-between p-ai-center p-mt-4">
      <h3>
        Total: {totalPrice.toFixed(2)} € {/* Immer eine JS-Number */}
      </h3>
      <Button
        label="Zur Kasse"
        icon="pi pi-credit-card"
        onClick={() => navigate('/cart/checkout')}
        disabled={cartItems.length === 0}
      />
    </div>
  );

  return (
    <div className="p-p-4">
      <h2>Warenkorb</h2>
      {cartItems.length > 0 ? (
        <DataTable value={cartItems} footer={footer} responsiveLayout="scroll">
          {/* Produktname */}
          <Column field="name" header="Produkt" />

          {/* Preis: Cast in Number, dann toFixed(2) */}
          <Column
            header="Preis (€)"
            body={(data) => Number(data.price).toFixed(2)}
            style={{ width: '8rem' }}
          />

          {/* Menge mit InputNumber */}
          <Column
            header="Menge"
            body={(data) => (
              <InputNumber
                value={data.quantity}
                onValueChange={(e) =>
                  handleQuantityChange(data.productId, e.value || 0)
                }
                min={1}
                showButtons
                buttonLayout="horizontal"
                decrementButtonClassName="p-button-text"
                incrementButtonClassName="p-button-text"
              />
            )}
            style={{ width: '8rem' }}
          />

          {/* Entfernen-Button */}
          <Column
            header="Entfernen"
            body={(data) => (
              <Button
                icon="pi pi-trash"
                className="p-button-icon-only p-button-danger"
                onClick={() => handleRemove(data.productId)}
              />
            )}
            style={{ width: '5rem' }}
          />
        </DataTable>
      ) : (
        <p>Ihr Warenkorb ist leer.</p>
      )}
    </div>
  );
};
