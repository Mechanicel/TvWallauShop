// frontend/src/pages/Admin/NewProductAiDialog.tsx

import React, { useState } from 'react';
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

const ProductAiDialog: React.FC<ProductAiDialogProps> = ({
   visible,
   onHide,
   onContinue,
   loading = false,
   error = null,
}) => {
   const [price, setPrice] = useState<number | null>(0);
   const [files, setFiles] = useState<File[]>([]);

   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (!fileList) {
         setFiles([]);
         return;
      }
      setFiles(Array.from(fileList));
   };

   const handleContinue = () => {
      const safePrice = price ?? 0;

      if (files.length === 0) {
         window.alert('Bitte lade mindestens ein Produktbild hoch.');
         return;
      }

      if (safePrice <= 0) {
         window.alert('Bitte gib einen gültigen Preis ein.');
         return;
      }

      onContinue({ price: safePrice, files });
   };

   const footer = (
      <div className="ai-dialog-footer">
         <Button label="Abbrechen" className="p-button-text" onClick={onHide} disabled={loading} />
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
         onHide={onHide}
         header="Neues Produkt – Schritt 1: Bilder & Preis"
         style={{ width: '520px', maxWidth: '100%' }}
         modal
         footer={footer}
         className="ai-product-dialog"
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
               <small className="ai-dialog-hint">
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
