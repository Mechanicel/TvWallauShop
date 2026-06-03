import { Toaster as SonnerToaster } from 'sonner';

/** App-wide toast host. Use `import { toast } from 'sonner'` to trigger toasts. */
export function Toaster() {
   return (
      <SonnerToaster
         position="top-right"
         richColors
         closeButton
         toastOptions={{ className: 'font-sans' }}
      />
   );
}
