// frontend/src/pages/Admin/NewProductAiDialog.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';

export interface ProductAiDialogProps {
   visible: boolean;
   onHide: () => void;
   onContinue: (payload: { price: number; files: File[] }) => void;
   loading?: boolean;
   error?: string | null;
}

const FilePreview: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
   const [previewUrl, setPreviewUrl] = useState<string>('');

   useEffect(() => {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
   }, [file]);

   return (
      <div style={{ position: 'relative', width: 80, height: 80 }}>
         <img
            src={previewUrl}
            alt={file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
         />
         <Button
            type="button"
            icon="pi pi-times"
            className="p-button-rounded p-button-danger p-button-sm"
            onClick={onRemove}
            style={{ position: 'absolute', top: 4, right: 4 }}
         />
      </div>
   );
};

const ProductAiDialog: React.FC<ProductAiDialogProps> = ({
   visible,
   onHide,
   onContinue,
   loading = false,
   error = null,
}) => {
   const [price, setPrice] = useState<number>(0);
   const [files, setFiles] = useState<File[]>([]);
   const fileInputRef = useRef<HTMLInputElement | null>(null);

   const resetState = () => {
      setPrice(0);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
   };

   // ✅ Bugfix: Parent kann per visible=false schließen, ohne dass handleHide läuft
   useEffect(() => {
      if (!visible) resetState();
   }, [visible]);

   const handleHide = () => {
      if (loading) return;
      resetState();
      onHide();
   };

   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      const selected = fileList ? Array.from(fileList) : [];
      if (selected.length === 0) return;

      setFiles((prev) => {
         const seen = new Set(prev.map((f) => `${f.name}__${f.size}__${f.lastModified}`));
         const uniqueToAdd = selected.filter((f) => {
            const key = `${f.name}__${f.size}__${f.lastModified}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
         });
         return [...prev, ...uniqueToAdd];
      });

      event.target.value = '';
   };

   const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

   const clearFiles = () => {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
   };

   const handleContinue = () => {
      if (files.length === 0) {
         window.alert('Bitte lade mindestens ein Produktbild hoch.');
         return;
      }
      onContinue({ price, files });
   };

   const footer = (
      <div className="ai-dialog-footer">
         <Button label="Abbrechen" className="p-button-text" onClick={handleHide} disabled={loading} />
         <Button
            label={loading ? 'Analyse läuft…' : 'KI-Analyse starten'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-arrow-right'}
            onClick={handleContinue}
            disabled={loading}
         />
      </div>
   );

   return (
      <Dialog
         header="Neues Produkt (KI Flow)"
         visible={visible}
         onHide={handleHide}
         footer={footer}
         style={{ width: '40rem' }}
         modal
         closable={!loading}
         dismissableMask={!loading}
      >
         <p className="ai-dialog-intro">
            Hier beginnt der neue KI-basierte Produkt-Flow. Zuerst lädst du nur die Bilder und den Preis hoch. Im
            Hintergrund wird ein KI-Job angelegt, der später automatisch Namen, Beschreibung und Tags vorschlagen kann.
         </p>

         {error && <p className="products-error">{error}</p>}

         <div className="form-grid">
            <div className="form-field form-field--full">
               <label>Produktbilder</label>

               <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={loading}
               />

               {files.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                     <small>{files.length} Datei(en) ausgewählt</small>
                     <Button
                        type="button"
                        label="Alle entfernen"
                        icon="pi pi-times"
                        className="p-button-text p-button-sm"
                        onClick={clearFiles}
                        disabled={loading}
                     />
                  </div>
               )}

               {files.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                     {files.map((file, idx) => (
                        <FilePreview
                           key={`${file.name}-${file.size}-${file.lastModified}`}
                           file={file}
                           onRemove={() => removeFile(idx)}
                        />
                     ))}
                  </div>
               )}
            </div>

            <div className="form-field form-field--full">
               <label>Preis</label>
               <InputNumber
                  value={price}
                  onValueChange={(e) => setPrice(e.value ?? 0)}
                  mode="currency"
                  currency="EUR"
                  locale="de-DE"
                  min={0}
                  disabled={loading}
               />
            </div>
         </div>
      </Dialog>
   );
};

export default ProductAiDialog;
