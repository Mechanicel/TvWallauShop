// frontend/src/pages/Admin/NewProductAiDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';

export interface ProductAiDialogProps {
   visible: boolean;
   onHide: () => void;
   /**
    * Wird aufgerufen, wenn der Admin Step 1 abgeschlossen hat.
    * Hier geben wir nur Preis + Files nach außen.
    * Zwischen diesem Step und dem Produktdialog kann der KI-Job gestartet werden.
    */
   onContinue: (payload: { price: number; files: File[] }) => void;
   loading?: boolean;
   error?: string | null;
}

/** Vorschau für neue Bilder (wie im ProductDialog) */
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
         <img src={src} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

const ProductAiDialog: React.FC<ProductAiDialogProps> = ({
   visible,
   onHide,
   onContinue,
   loading = false,
   error = null,
}) => {
   const [price, setPrice] = useState<number>(0);
   const [files, setFiles] = useState<File[]>([]);

   /* ---------------------------------------------
    * Reset-Logik (zentral & kontrolliert)
    * ------------------------------------------- */
   const resetState = () => {
      setPrice(0);
      setFiles([]);
   };

   const handleHide = () => {
      if (loading) return; // während KI-Analyse nicht schließen
      resetState();
      onHide();
   };

   /* ---------------------------------------------
    * File Upload (mit Duplikat-Schutz)
    * ------------------------------------------- */
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

      // erlaubt erneutes Auswählen derselben Datei
      event.target.value = '';
   };

   /* ---------------------------------------------
    * Continue
    * ------------------------------------------- */
   const handleContinue = () => {
      if (files.length === 0) {
         window.alert('Bitte lade mindestens ein Produktbild hoch.');
         return;
      }

      if (price <= 0) {
         window.alert('Bitte gib einen gültigen Preis ein.');
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
         visible={visible}
         onHide={handleHide}
         header="Neues Produkt – Schritt 1: Bilder & Preis"
         style={{ width: '520px', maxWidth: '100%' }}
         modal
         footer={footer}
         className="ai-product-dialog"
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

               <input type="file" multiple accept="image/*" onChange={handleFileChange} disabled={loading} />

               {files.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                     <small>{files.length} Datei(en) ausgewählt</small>
                     <Button
                        type="button"
                        label="Alle entfernen"
                        icon="pi pi-times"
                        className="p-button-text p-button-sm"
                        onClick={() => setFiles([])}
                        disabled={loading}
                     />
                  </div>
               )}

               {files.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem' }}>
                     {files.map((file, index) => (
                        <NewImagePreview
                           key={`${file.name}-${index}`}
                           file={file}
                           onRemove={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                        />
                     ))}
                  </div>
               )}

               <small className="ai-dialog-hint" style={{ display: 'block', marginTop: '0.5rem' }}>
                  Du kannst mehrere Bilder auswählen. Diese werden im KI-Job ausgewertet und anschließend gemeinsam mit
                  den Produktdetails gespeichert.
               </small>
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
