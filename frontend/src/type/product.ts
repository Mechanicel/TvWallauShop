// frontend/src/type/product.ts
export type {
   Product,
   ProductAiJob,
   ProductAiJobStatus,
   ProductImage,
   ProductPayload,
   ProductSize,
} from '@tvwallaushop/contracts';

export interface CreateProductAiJobParams {
   price: number;
   files: File[];
}
