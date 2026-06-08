// frontend/src/pages/Admin/Product/ProductDialog.tsx

import React, { useEffect, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import type { Product, ProductSize } from '@/type/product';
import { resolveImageUrl } from '@/utils/imageUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type EditableProduct = Omit<Product, 'id'> & { id?: number };

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

const NewImagePreview: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
   const [src, setSrc] = useState('');

   useEffect(() => {
      const objectUrl = URL.createObjectURL(file);
      setSrc(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
   }, [file]);

   return (
      <div className="relative h-24 w-24 overflow-hidden rounded-md border border-solid border-border">
         <img src={src} alt={file.name} className="h-full w-full object-cover" />
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
   const [newTag, setNewTag] = useState('');

   const updateField = (field: keyof Omit<Product, 'id' | 'sizes' | 'images'>, value: string | number) => {
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
      onProductChange({ ...product, sizes: product.sizes.filter((_, i) => i !== index) });
   };

   const handleSizeChange = (index: number, field: keyof ProductSize, value: string | number) => {
      if (!product) return;
      const sizes = product.sizes.map((s, i) => (i === index ? { ...s, [field]: value } : s));
      onProductChange({ ...product, sizes });
   };

   const handleAddTag = () => {
      if (!product) return;
      const tag = newTag.trim();
      if (!tag) return;
      const current = product.tags ?? [];
      if (current.includes(tag)) {
         setNewTag('');
         return;
      }
      onProductChange({ ...product, tags: [...current, tag] });
      setNewTag('');
   };

   const handleRemoveTag = (tagToRemove: string) => {
      if (!product) return;
      const current = product.tags ?? [];
      onProductChange({ ...product, tags: current.filter((t) => t !== tagToRemove) });
   };

   return (
      <Dialog open={visible} onOpenChange={(open) => !open && onHide()}>
         <DialogContent className="max-w-2xl">
            <DialogHeader>
               <DialogTitle>{title}</DialogTitle>
            </DialogHeader>

            {product && (
               <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="name">Name</Label>
                     <Input id="name" value={product.name} onChange={(e) => updateField('name', e.target.value)} />
                  </div>

                  <div className="flex flex-col gap-2">
                     <Label htmlFor="description">Beschreibung</Label>
                     <Textarea
                        id="description"
                        rows={3}
                        value={product.description ?? ''}
                        onChange={(e) => updateField('description', e.target.value)}
                     />
                  </div>

                  <div className="flex flex-col gap-2">
                     <Label htmlFor="price">Preis (€)</Label>
                     <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        className="max-w-[12rem]"
                        value={product.price}
                        onChange={(e) => updateField('price', e.target.value === '' ? 0 : Number(e.target.value))}
                     />
                  </div>

                  {/* Tags */}
                  <div className="flex flex-col gap-2">
                     <Label>Tags</Label>
                     <div className="flex flex-wrap gap-2">
                        {(product.tags ?? []).length === 0 && (
                           <span className="text-sm text-muted-foreground">
                              Noch keine Tags – die KI kann hier Vorschläge machen.
                           </span>
                        )}
                        {(product.tags ?? []).map((tag) => (
                           <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                           >
                              {tag}
                              <button
                                 type="button"
                                 onClick={() => handleRemoveTag(tag)}
                                 aria-label={`Tag ${tag} entfernen`}
                                 className="text-muted-foreground hover:text-foreground"
                              >
                                 <X className="h-3 w-3" />
                              </button>
                           </span>
                        ))}
                     </div>
                     <div className="flex gap-2">
                        <Input
                           value={newTag}
                           onChange={(e) => setNewTag(e.target.value)}
                           placeholder="Neuen Tag eingeben"
                           onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                 e.preventDefault();
                                 handleAddTag();
                              }
                           }}
                        />
                        <Button type="button" variant="outline" onClick={handleAddTag}>
                           <Plus className="h-4 w-4" />
                           Hinzufügen
                        </Button>
                     </div>
                  </div>

                  {/* Upload */}
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="product-images">Bilder hochladen (optional)</Label>
                     <Input
                        id="product-images"
                        type="file"
                        multiple
                        accept="image/*"
                        className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
                        onChange={(e) => {
                           const files = e.target.files ? Array.from(e.target.files) : [];
                           onUploadFilesChange([...uploadFiles, ...files]);
                        }}
                     />
                     {uploadFiles.length > 0 && (
                        <span className="text-xs text-muted-foreground">{uploadFiles.length} neue Datei(en)</span>
                     )}
                  </div>

                  {uploadFiles.length > 0 && (
                     <div className="flex flex-col gap-2">
                        <Label>Neue Bilder (noch nicht gespeichert)</Label>
                        <div className="flex flex-wrap gap-3">
                           {uploadFiles.map((file, index) => (
                              <NewImagePreview
                                 key={file.name + index}
                                 file={file}
                                 onRemove={() => onUploadFilesChange(uploadFiles.filter((_, i) => i !== index))}
                              />
                           ))}
                        </div>
                     </div>
                  )}

                  {product.images.length > 0 && (
                     <div className="flex flex-col gap-2">
                        <Label>Vorhandene Bilder</Label>
                        <div className="flex flex-wrap gap-3">
                           {product.images.map((img) => (
                              <div
                                 key={img.id}
                                 className="relative h-24 w-24 overflow-hidden rounded-md border border-solid border-border"
                              >
                                 <img src={resolveImageUrl(img.url)} alt="" className="h-full w-full object-cover" />
                                 {onDeleteImage && (
                                    <button
                                       type="button"
                                       aria-label="Bild löschen"
                                       onClick={() => onDeleteImage(img.id)}
                                       className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                                    >
                                       <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                 )}
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  {/* Größen */}
                  <div className="flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                        <Label>Größen</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={handleAddSize}>
                           <Plus className="h-4 w-4" />
                           Größe hinzufügen
                        </Button>
                     </div>
                     {product.sizes.map((size, index) => (
                        <div key={index} className="flex items-center gap-2">
                           <Input
                              value={size.label}
                              onChange={(e) => handleSizeChange(index, 'label', e.target.value)}
                              placeholder="Label"
                           />
                           <Input
                              type="number"
                              min="0"
                              className="max-w-[8rem]"
                              value={size.stock}
                              onChange={(e) => handleSizeChange(index, 'stock', e.target.value === '' ? 0 : Number(e.target.value))}
                              placeholder="Bestand"
                           />
                           <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleRemoveSize(index)}
                           >
                              <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            <DialogFooter>
               <Button variant="outline" onClick={onHide}>
                  Abbrechen
               </Button>
               <Button onClick={onSave}>
                  <Check className="h-4 w-4" />
                  Speichern
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export default ProductDialog;
