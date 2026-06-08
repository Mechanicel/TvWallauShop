// frontend/src/components/Footer/Footer.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
   return (
      <footer className="border-t border-solid border-border bg-background">
         <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Dein Verein. Alle Rechte vorbehalten.</p>
            <nav className="flex gap-4">
               <Link to="/impressum" className="font-medium text-foreground transition-colors hover:text-primary">
                  Impressum
               </Link>
               <Link to="/datenschutz" className="font-medium text-foreground transition-colors hover:text-primary">
                  Datenschutz
               </Link>
            </nav>
         </div>
      </footer>
   );
};
