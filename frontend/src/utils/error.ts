import { isAxiosError } from 'axios';

type ApiErrorPayload = {
   message?: string;
   error?: string;
};

export const getApiErrorMessage = (err: unknown, fallback = 'Ein Fehler ist aufgetreten.'): string => {
   if (typeof err === 'string') {
      return err;
   }

   if (isAxiosError(err)) {
      const data = err.response?.data as ApiErrorPayload | undefined;

      if (data?.message) {
         return String(data.message);
      }

      if (data?.error) {
         return String(data.error);
      }

      if (err.message) {
         return err.message;
      }

      return fallback;
   }

   if (err && typeof err === 'object') {
      const anyErr = err as ApiErrorPayload & { message?: string };

      if (anyErr.message) {
         return String(anyErr.message);
      }

      if (anyErr.error) {
         return String(anyErr.error);
      }
   }

   return fallback;
};
