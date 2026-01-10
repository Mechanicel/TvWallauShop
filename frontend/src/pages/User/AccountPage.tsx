import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout, selectAuth } from '@/store/slices/authSlice';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';
import './AccountPage.css';

export const AccountPage: React.FC = () => {
   const { user } = useAppSelector(selectAuth);
   const dispatch = useAppDispatch();
   const navigate = useNavigate();

   const go = (path: string) => navigate(path);

   const clickable = (path: string) => ({
      role: 'button' as const,
      tabIndex: 0,
      onClick: () => go(path),
      onKeyDown: (e: React.KeyboardEvent) => {
         if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            go(path);
         }
      },
   });

   const handleLogout = () => {
      dispatch(logout());
      navigate('/');
   };

   // Admin optional (ohne Typ-Annahmen zu erzwingen)
   const isAdmin = !!(user as any)?.isAdmin || (user as any)?.role === 'admin' || !!(user as any)?.is_admin;

   if (!user) {
      return (
         <div className="account-page">
            <h2>Mein Konto</h2>

            <div className="account-wrapper account-empty">
               <p className="account-empty-text">Du bist aktuell nicht eingeloggt.</p>
               <div className="account-empty-actions">
                  <Button
                     label="Zum Login"
                     icon="pi pi-sign-in"
                     onClick={() => go('/login')}
                     className="account-primary-btn"
                  />
                  <Button
                     label="Zur Startseite"
                     icon="pi pi-home"
                     className="p-button-outlined"
                     onClick={() => go('/')}
                  />
               </div>
            </div>
         </div>
      );
   }

   const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Account';

   const avatarLabel = ((user.firstName?.[0] ?? user.email?.[0] ?? '?') as string).toUpperCase();

   return (
      <div className="account-page">
         <h2>Mein Konto</h2>

         <div className="account-wrapper">
            {/* Hero */}
            <div className="account-hero">
               <div className="account-hero-left">
                  <Avatar label={avatarLabel} size="xlarge" className="account-avatar" />
                  <div className="account-hero-meta">
                     <h3 className="account-name">{displayName}</h3>
                     <p className="account-email">{user.email}</p>
                  </div>
               </div>

               <div className="account-hero-right">
                  <Button
                     label="Abmelden"
                     icon="pi pi-sign-out"
                     className="p-button-outlined account-logout"
                     onClick={handleLogout}
                  />
               </div>
            </div>

            <div className="account-divider" />

            {/* Clickable Tiles */}
            <div className="account-grid">
               <div className="account-tile account-tile-clickable" {...clickable('/user/profile')}>
                  <div className="account-tile-head">
                     <i className="pi pi-user account-tile-icon" />
                     <div>
                        <div className="account-tile-title">Meine Daten</div>
                        <div className="account-tile-desc">Profil ansehen und bearbeiten</div>
                     </div>
                  </div>
                  <i className="pi pi-angle-right account-tile-arrow" />
               </div>

               <div className="account-tile account-tile-clickable" {...clickable('/user/orders')}>
                  <div className="account-tile-head">
                     <i className="pi pi-shopping-bag account-tile-icon" />
                     <div>
                        <div className="account-tile-title">Meine Bestellungen</div>
                        <div className="account-tile-desc">Status, Details & Historie</div>
                     </div>
                  </div>
                  <i className="pi pi-angle-right account-tile-arrow" />
               </div>

               <div className="account-tile account-tile-clickable" {...clickable('/user/settings')}>
                  <div className="account-tile-head">
                     <i className="pi pi-cog account-tile-icon" />
                     <div>
                        <div className="account-tile-title">Einstellungen</div>
                        <div className="account-tile-desc">Passwort, Newsletter, Zahlart</div>
                     </div>
                  </div>
                  <i className="pi pi-angle-right account-tile-arrow" />
               </div>

               <div className="account-tile account-tile-clickable account-tile-primary" {...clickable('/cart')}>
                  <div className="account-tile-head">
                     <i className="pi pi-shopping-cart account-tile-icon" />
                     <div>
                        <div className="account-tile-title">Warenkorb</div>
                        <div className="account-tile-desc">Weiter einkaufen oder zur Kasse</div>
                     </div>
                  </div>
                  <i className="pi pi-angle-right account-tile-arrow" />
               </div>

               {isAdmin && (
                  <div className="account-tile account-tile-clickable account-tile-admin" {...clickable('/admin')}>
                     <div className="account-tile-head">
                        <i className="pi pi-shield account-tile-icon" />
                        <div>
                           <div className="account-tile-title">Admin</div>
                           <div className="account-tile-desc">Dashboard & Verwaltung</div>
                        </div>
                     </div>
                     <i className="pi pi-angle-right account-tile-arrow" />
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};
