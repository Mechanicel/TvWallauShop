// frontend/src/components/Footer.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
    return (
        <footer className="app-footer">
            <p className="app-footer__copy">
                &copy; {new Date().getFullYear()} Dein Verein. Alle Rechte vorbehalten.
            </p>
            <nav className="app-footer__nav">
                <Link to="/impressum" className="app-footer__link">Impressum</Link>
                <Link to="/datenschutz" className="app-footer__link">Datenschutz</Link>
            </nav>
        </footer>
    );
};

export default Footer;
