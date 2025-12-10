// frontend/src/pages/Shop/ProductDetailPage.tsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch } from '../../store';
import { addToCart } from '../../store/slices/cartSlice';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import productService from '../../services/productService';
import type { Product, ProductSize } from '../../type/product';
import { resolveImageUrl } from '../../utils/imageUrl';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const toast = useRef<Toast>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Index statt URL — das macht Pfeile super einfach!
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await productService.getProduct(Number(id));
        setProduct(data);

        if (data.sizes.length > 0) {
          setSelectedSizeId(data.sizes[0].id);
        }

        // Aktives Bild bestimmen
        if (data.images?.length > 0) {
          const primaryIndex = data.images.findIndex((img) => img.isPrimary);
          setActiveIndex(primaryIndex >= 0 ? primaryIndex : 0);
        } else {
          setActiveIndex(0);
        }
      } catch (err) {
        console.error('Fehler beim Laden des Produkts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handlePrev = () => {
    if (!product?.images?.length) return;
    setActiveIndex((prev) =>
      prev === 0 ? product.images.length - 1 : prev - 1,
    );
  };

  const handleNext = () => {
    if (!product?.images?.length) return;
    setActiveIndex((prev) =>
      prev === product.images.length - 1 ? 0 : prev + 1,
    );
  };

  const handleAddToCart = () => {
    if (!product || selectedSizeId == null) return;

    const size = product.sizes.find((s) => s.id === selectedSizeId)!;

    dispatch(
      addToCart({
        productId: product.id,
        name: `${product.name} (${size.label})`,
        price: Number(product.price),
        quantity,
        sizeId: size.id,
      }),
    );

    toast.current?.show({
      severity: 'success',
      summary: 'Hinzugefügt',
      detail: `${product.name} in Größe ${size.label} zum Warenkorb hinzugefügt.`,
      life: 3000,
    });
  };

  if (loading) return <p>Lädt…</p>;
  if (!product) return <p>Produkt nicht gefunden.</p>;

  const images = product.images?.length
    ? product.images
    : [{ url: product.imageUrl }];
  const mainImageSrc = resolveImageUrl(images[activeIndex].url);

  const sizeOptions = product.sizes.map((s: ProductSize) => ({
    label: s.label,
    value: s.id,
  }));

  const qtyOptions = [1, 2, 3, 4, 5].map((n) => ({
    label: String(n),
    value: n,
  }));

  return (
    <div className="p-d-flex p-jc-center p-mt-4">
      <Toast ref={toast} />

      <Card
        title={product.name}
        subTitle={product.description}
        header={
          <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
            {/* Hauptbild */}
            <img
              src={mainImageSrc}
              alt={product.name}
              style={{
                width: '100%',
                borderRadius: '6px',
                objectFit: 'cover',
              }}
            />

            {/* ⬅️ LINKER PFEIL */}
            {images.length > 1 && (
              <button
                onClick={handlePrev}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '10px',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.4)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                ‹
              </button>
            )}

            {/* ➡️ RECHTER PFEIL */}
            {images.length > 1 && (
              <button
                onClick={handleNext}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '10px',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.4)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                ›
              </button>
            )}

            {/* Thumbnails */}
            {images.length > 1 && (
              <div
                style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                {images.map((img, i) => {
                  const thumbSrc = resolveImageUrl(img.url);
                  const active = i === activeIndex;

                  return (
                    <img
                      key={img.url + i}
                      src={thumbSrc}
                      onClick={() => setActiveIndex(i)}
                      alt="thumbnail"
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: 'cover',
                        cursor: 'pointer',
                        borderRadius: 4,
                        border: active ? '2px solid #007ad9' : '1px solid #ccc',
                        opacity: active ? 1 : 0.8,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        }
        footer={
          <div className="p-d-flex p-jc-between p-ai-center">
            <span className="p-text-bold">{product.price.toFixed(2)} €</span>
            <Button
              label="In den Warenkorb"
              icon="pi pi-shopping-cart"
              onClick={handleAddToCart}
              disabled={selectedSizeId == null}
            />
          </div>
        }
        style={{ width: '100%', maxWidth: '800px', margin: '0 1rem' }}
      >
        <div className="p-field p-mb-3">
          <label htmlFor="size">Größe wählen</label>
          <Dropdown
            id="size"
            value={selectedSizeId}
            options={sizeOptions}
            onChange={(e) => setSelectedSizeId(e.value as number)}
            placeholder="Größe auswählen"
          />
        </div>

        <div className="p-field">
          <label htmlFor="quantity">Menge</label>
          <Dropdown
            id="quantity"
            value={quantity}
            options={qtyOptions}
            onChange={(e) => setQuantity(e.value as number)}
          />
        </div>
      </Card>
    </div>
  );
};
