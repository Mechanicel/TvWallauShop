/**
 * Ein Eintrag im Warenkorb.
 * Größe (sizeId) ist optional und kann auch null sein.
 */
export interface CartItem {
   productId?: number;
   name: string;
   price: number;
   quantity: number;
   sizeId?: number | null;
   /**
    * Anzeige-Label der Größe (z.B. "M", "L"), optional.
    */
   sizeLabel?: string | null;
   /**
    * Bild-URL des Produkts (relativer Pfad wie im Produkt.imageUrl / images[i].url)
    */
   imageUrl?: string | null;
}

export interface CartState {
   items: CartItem[];
}

export const initialState: CartState = {
   items: [],
};
