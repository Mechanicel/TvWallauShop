// frontend/src/pages/Admin/Product/ProductAiDialog.tsx

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ProductAiDialogProps {
   visible: boolean;
   onHide: () => void;
   onContinue: (payload: { price: number; files: File[] }) => void;
   loading?: boolean;
   error?: string | null;
}

const FilePreview: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
   const [previewUrl, setPreviewUrl] = useState('');

   useEffect(() => {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
   }, [file]);

   return (
      <div className="relative h-20 w-20 overflow-hidden rounded-md border border-solid border-border">
         <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
         <button
            type="button"
            aria-label="Bild entfernen"
            onClick={onRemove}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
         >
            <X className="h-3.5 w-3.5" />
         </button>
      </div>
   );
};

const ProductAiDialog: React.FC<ProductAiDialogProps> = ({ visible, onHide, onContinue, loading = false, error = null }) => {
   const [price, setPrice] = useState<number>(0);
   const [files, setFiles] = useState<File[]>([]);
   const fileInputRef = useRef<HTMLInputElement | null>(null);

   const resetState = () => {
      setPrice(0);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
   };

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

   return (
      <Dialog open={visible} onOpenChange={(open) => !open && handleHide()}>
         <DialogContent className="max-w-2xl">
            <DialogHeader>
               <DialogTitle>Neues Produkt (KI-Flow)</DialogTitle>
               <DialogDescription>
                  Lade zunächst nur die Bilder und den Preis hoch. Im Hintergrund wird ein KI-Job angelegt, der Namen,
                  Beschreibung und Tags vorschlägt.
               </DialogDescription>
            </DialogHeader>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col gap-2">
               <Label htmlFor="ai-images">Produktbilder</Label>
               <Input
                  id="ai-images"
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  disabled={loading}
                  onChange={handleFileChange}
                  className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
               />
               {files.length > 0 && (
                  <div className="flex items-center gap-2">
                     <span className="text-xs text-muted-foreground">{files.length} Datei(en) ausgewählt</span>
                     <Button type="button" variant="ghost" size="sm" onClick={clearFiles} disabled={loading}>
                        <X className="h-4 w-4" />
                        Alle entfernen
                     </Button>
                  </div>
               )}
               {files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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

            <div className="flex flex-col gap-2">
               <Label htmlFor="ai-price">Preis (€)</Label>
               <Input
                  id="ai-price"
                  type="number"
                  step="0.01"
                  min="0"
                  className="max-w-[12rem]"
                  value={price}
                  disabled={loading}
                  onChange={(e) => setPrice(e.target.value === '' ? 0 : Number(e.target.value))}
               />
            </div>

            <DialogFooter>
               <Button variant="outline" onClick={handleHide} disabled={loading}>
                  Abbrechen
               </Button>
               <Button onClick={handleContinue} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {loading ? 'Analyse läuft …' : 'KI-Analyse starten'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export default ProductAiDialog;
