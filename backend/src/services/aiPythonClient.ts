// backend/src/services/aiPythonClient.ts
import axios, { AxiosResponse } from 'axios';
import type { AnalyzeProductRequest, AnalyzeProductResponse, ImageRef } from '@tvwallaushop/contracts';

export type AnalyzeProductPayload = {
    jobId: number;
    price: number;
    imageUrls: string[];
};

const AI_PY_SERVICE_URL = (process.env.AI_PY_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const AI_PY_TIMEOUT_MS = Number(process.env.AI_PY_TIMEOUT_MS || 8000); // ⬅ kürzer, schneller FAIL

/**
 * Ruft den Python-AI-Service auf und analysiert ein Produkt
 */
export async function analyzeProductViaPython(
    payload: AnalyzeProductPayload
): Promise<AnalyzeProductResponse> {
    const url = `${AI_PY_SERVICE_URL}/analyze-product`;
    const images: ImageRef[] = payload.imageUrls.map((url) => ({
        kind: 'url',
        value: url,
    }));

    const res: AxiosResponse<AnalyzeProductResponse> = await axios.post(
        url,
        {
            jobId: payload.jobId,
            price: {
                amount: payload.price,
            },
            images,
        },
        {
            timeout: AI_PY_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/json' },
        }
    );

    return res.data;
}
