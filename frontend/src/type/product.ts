// frontend/src/type/product.ts

export interface ProductSize {
  id: number;
  label: string;
  stock: number;
}

export interface ProductImage {
  id: number;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  sizes: ProductSize[];
  images: ProductImage[]; // 👈 neu: alle Bilder aus product_images
}
