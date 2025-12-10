// backend/src/errors/InsufficientStockError.ts

export class InsufficientStockError extends Error {
    public status: number;
    public code: string;
    public details: {
        productId: number;
        sizeId: number | null;
        available: number;
        requested: number;
    };

    constructor(
        productId: number,
        sizeId: number | null,
        available: number,
        requested: number
    ) {
        super('INSUFFICIENT_STOCK');
        this.name = 'InsufficientStockError';
        // HTTP-Status wird bewusst auf 200 gesetzt, damit es sich
        // um einen fachlichen (Business-)Fehler und keinen "harten" HTTP-Fehler handelt.
        this.status = 200;
        this.code = 'INSUFFICIENT_STOCK';
        this.details = { productId, sizeId, available, requested };
    }
}
