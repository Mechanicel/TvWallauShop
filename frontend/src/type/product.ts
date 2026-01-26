// frontend/src/type/product.ts
import type {
   Product,
   ProductAiJob as ContractProductAiJob,
   ProductAiJobStatus,
   ProductImage,
   ProductPayload,
   ProductSize,
} from '@tvwallaushop/contracts';

export type { Product, ProductAiJobStatus, ProductImage, ProductPayload, ProductSize };

export interface ProductAiJob extends ContractProductAiJob {
   price?: number;
   image_paths?: string[];
}

export interface CreateProductAiJobParams {
   price: number;
   files: File[];
}
