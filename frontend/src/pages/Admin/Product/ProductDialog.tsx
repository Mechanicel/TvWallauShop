// frontend/src/pages/Admin/ProductDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';

import type { Product, ProductSize } from '@/type/product';
import { resolveImageUrl } from '@/utils/imageUrl';
import './ManageProducts.css';

export type EditableProduct = Product & { id?: number };

interface ProductDialogProps {
  visible: boolean;
  title?: string;
  product: EditableProduct | null;
  uploadFiles: File[];
  onProductChange: (product: EditableProduct | null) => void;
  onUploadFilesChange: (files: File[]) => void;
  onHide: () => void;
  onSave: () => void;
  onDeleteImage?: (imageId: number) => void | Promise<void>;
}

/** Vorschau für neue Bilder */
const NewImagePreview: React.FC<{
  file: File;
  onRemove: () => void;
}> = ({ file, onRemove }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div
      style={{
        position: 'relative',
        width: 90,
        height: 90,
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid #ccc',
      }}
    >
      <img
        src={src}
        alt={file.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <Button
        type="button"
        icon="pi pi-trash"
        className="p-button-danger p-button-rounded p-button-sm"
        onClick={onRemove}
        style={{ position: 'absolute', top: 4, right: 4 }}
      />
    </div>
  );
};

const ProductDialog: React.FC<ProductDialogProps> = ({
  visible,
  title = 'Produkt',
  product,
  uploadFiles,
  onProductChange,
  onUploadFilesChange,
  onHide,
  onSave,
  onDeleteImage,
}) => {
  const updateField = (
    field: keyof Omit<Product, 'id' | 'sizes' | 'images'>,
    value: string | number,
  ) => {
    if (!product) return;
    onProductChange({ ...product, [field]: value });
  };

  const handleAddSize = () => {
    if (!product) return;
    const newSize: ProductSize = {
      id: (crypto as any)?.randomUUID?.() ?? Date.now(),
      label: '',
      stock: 0,
    };
    onProductChange({ ...product, sizes: [...product.sizes, newSize] });
  };

  const handleRemoveSize = (index: number) => {
    if (!product) return;
    onProductChange({
      ...product,
      sizes: product.sizes.filter((_, i) => i !== index),
    });
  };

  const handleSizeChange = (
    index: number,
    field: keyof ProductSize,
    value: string | number,
  ) => {
    if (!product) return;
    const sizes = product.sizes.map((s, i) =>
      i === index ? { ...s, [field]: value } : s,
    );
    onProductChange({ ...product, sizes });
  };

  const footer = (
    <>
      <Button
        label="Abbrechen"
        icon="pi pi-times"
        onClick={onHide}
        className="p-button-text"
      />
      <Button label="Speichern" icon="pi pi-check" onClick={onSave} autoFocus />
    </>
  );

  return (
    <Dialog
      visible={visible}
      style={{ width: '650px' }}
      header={title}
      modal
      footer={footer}
      onHide={onHide}
    >
      {!product ? null : (
        <div className="p-fluid">
          {/* Name */}
          <div className="p-field">
            <label htmlFor="name">Name</label>
            <InputText
              id="name"
              value={product.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>

          {/* Beschreibung */}
          <div className="p-field">
            <label htmlFor="description">Beschreibung</label>
            <InputTextarea
              id="description"
              rows={3}
              value={product.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>

          {/* Preis */}
          <div className="p-field">
            <label htmlFor="price">Preis</label>
            <InputNumber
              id="price"
              value={product.price}
              onValueChange={(e) =>
                updateField('price', e.value ?? product.price)
              }
              mode="currency"
              currency="EUR"
              locale="de-DE"
            />
          </div>

          {/* ——————————————————————————————— */}
          {/* 🟢 BILD-URL wurde ENTFERNT — komplett raus */}
          {/* ——————————————————————————————— */}

          {/* Upload */}
          <div className="p-field">
            <label>Bilder hochladen (optional)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                onUploadFilesChange([...uploadFiles, ...files]);
              }}
            />
            {uploadFiles.length > 0 && (
              <small>{uploadFiles.length} neue Datei(en)</small>
            )}
          </div>

          {/* Neue Bilder */}
          {uploadFiles.length > 0 && (
            <div className="p-field">
              <label>Neue Bilder (noch nicht gespeichert)</label>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                }}
              >
                {uploadFiles.map((file, index) => (
                  <NewImagePreview
                    key={file.name + index}
                    file={file}
                    onRemove={() =>
                      onUploadFilesChange(
                        uploadFiles.filter((_, i) => i !== index),
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Vorhandene Bilder */}
          {product.images.length > 0 && (
            <div className="p-field">
              <label>Vorhandene Bilder</label>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                }}
              >
                {product.images.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      position: 'relative',
                      width: 90,
                      height: 90,
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid #ccc',
                    }}
                  >
                    <img
                      src={resolveImageUrl(img.url)}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {onDeleteImage && (
                      <Button
                        type="button"
                        icon="pi pi-trash"
                        className="p-button-danger p-button-rounded p-button-sm"
                        onClick={() => onDeleteImage(img.id)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Größen */}
          <div className="p-field">
            <div className="sizes-header">
              <span>Größen</span>
              <Button
                type="button"
                icon="pi pi-plus"
                label="Größe hinzufügen"
                onClick={handleAddSize}
                className="p-button-sm p-button-text"
              />
            </div>

            {product.sizes.map((size, index) => (
              <div key={index} className="size-row">
                <InputText
                  value={size.label}
                  onChange={(e) =>
                    handleSizeChange(index, 'label', e.target.value)
                  }
                  placeholder="Label"
                />
                <InputNumber
                  value={size.stock}
                  onValueChange={(e) =>
                    handleSizeChange(index, 'stock', e.value ?? 0)
                  }
                  placeholder="Bestand"
                />
                <Button
                  icon="pi pi-trash"
                  className="p-button-danger p-button-text p-button-sm"
                  onClick={() => handleRemoveSize(index)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default ProductDialog;
