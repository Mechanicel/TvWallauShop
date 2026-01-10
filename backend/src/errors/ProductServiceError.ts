// backend/src/errors/ProductServiceError.ts

export type ProductServiceErrorCode =
    | 'PRODUCT_NOT_FOUND'
    | 'PRODUCT_VALIDATION_ERROR'
    | 'PRODUCT_IMAGE_NOT_FOUND'
    | 'PRODUCT_IMAGE_TABLE_MISSING';

export class ProductServiceError extends Error {
    public status: number;
    public code: ProductServiceErrorCode;
    public details?: Record<string, unknown>;

    constructor(
        message: string,
        status: number,
        code: ProductServiceErrorCode,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ProductServiceError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export class ProductNotFoundError extends ProductServiceError {
    constructor(productId?: number) {
        super('Product not found', 404, 'PRODUCT_NOT_FOUND', {
            productId,
        });
        this.name = 'ProductNotFoundError';
    }
}

export class ProductValidationError extends ProductServiceError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 400, 'PRODUCT_VALIDATION_ERROR', details);
        this.name = 'ProductValidationError';
    }
}

export class ProductImageNotFoundError extends ProductServiceError {
    constructor(productId: number, imageId: number) {
        super('Image not found', 404, 'PRODUCT_IMAGE_NOT_FOUND', {
            productId,
            imageId,
        });
        this.name = 'ProductImageNotFoundError';
    }
}

export class ProductImageTableMissingError extends ProductServiceError {
    constructor() {
        super(
            'Table "product_images" not found. Please create it in the database.',
            500,
            'PRODUCT_IMAGE_TABLE_MISSING'
        );
        this.name = 'ProductImageTableMissingError';
    }
}
