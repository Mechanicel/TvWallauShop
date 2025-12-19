// backend/src/services/aiPythonClient.ts
import axios, {AxiosResponse} from 'axios';

export type AnalyzeProductRequest = {
    jobId: number;
    price: number;
    imageUrls: string[];
};

export type AnalyzeProductResponse = {
    job_id?: number | null;
    display_name: string;
    description: string;
    tags: string[];
};

const AI_PY_SERVICE_URL = (process.env.AI_PY_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const AI_PY_TIMEOUT_MS = Number(process.env.AI_PY_TIMEOUT_MS || 8000); // ⬅ kürzer, schneller FAIL

/**
 * Ruft den Python-AI-Service auf und analysiert ein Produkt
 */
export async function analyzeProductViaPython(
    payload: AnalyzeProductRequest
): Promise<AnalyzeProductResponse> {
    const url = `${AI_PY_SERVICE_URL}/analyze-product`;

    const res: AxiosResponse<AnalyzeProductResponse> = await axios.post(
        url,
        {
            job_id: payload.jobId,
            price: payload.price,
            image_paths: payload.imageUrls,
        },
        {
            timeout: AI_PY_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/json' },
        }
    );

    return res.data;
}