import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Cog, Home, LogIn, LogOut, ShieldCheck, ShoppingBag, ShoppingCart, User } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout, selectAuth } from '@/store/slices/authSlice';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

type Tile = {
   to: string;
   icon: React.ReactNode;
   title: string;
   desc: string;
   primary?: boolean;
};

export const AccountPage: React.FC = () => {
   const { user } = useAppSelector(selectAuth);
   const dispatch = useAppDispatch();
   const navigate = useNavigate();

   const go = (path: string) => navigate(path);

   const handleLogout = () => {
      dispatch(logout());
      navigate('/');
   };

   const isAdmin = !!(user as any)?.isAdmin || (user as any)?.role === 'admin' || !!(user as any)?.is_admin;

   if (!user) {
      return (
         <div className="tw-scope mx-auto max-w-3xl px-4 py-8">
            <h1 className="mb-6 text-2xl font-semibold text-foreground">Mein Konto</h1>
            <div className="flex flex-col items-center gap-4 rounded-lg border border-solid border-border bg-surface p-8 text-center">
               <p className="text-muted-foreground">Du bist aktuell nicht eingeloggt.</p>
               <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={() => go('/login')}>
                     <LogIn className="h-4 w-4" />
                     Zum Login
                  </Button>
                  <Button variant="outline" onClick={() => go('/')}>
                     <Home className="h-4 w-4" />
                     Zur Startseite
                  </Button>
               </div>
            </div>
         </div>
      );
   }

   const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Account';
   const avatarLabel = ((user.firstName?.[0] ?? user.email?.[0] ?? '?') as string).toUpperCase();

   const tiles: Tile[] = [
      { to: '/user/profile', icon: <User className="h-5 w-5" />, title: 'Meine Daten', desc: 'Profil ansehen und bearbeiten' },
      { to: '/user/orders', icon: <ShoppingBag className="h-5 w-5" />, title: 'Meine Bestellungen', desc: 'Status, Details & Historie' },
      { to: '/user/settings', icon: <Cog className="h-5 w-5" />, title: 'Einstellungen', desc: 'Passwort, Newsletter, Zahlart' },
      { to: '/cart', icon: <ShoppingCart className="h-5 w-5" />, title: 'Warenkorb', desc: 'Weiter einkaufen oder zur Kasse', primary: true },
   ];
   if (isAdmin) {
      tiles.push({ to: '/admin', icon: <ShieldCheck className="h-5 w-5" />, title: 'Admin', desc: 'Dashboard & Verwaltung' });
   }

   return (
      <div className="tw-scope mx-auto max-w-3xl px-4 py-8">
         <h1 className="mb-6 text-2xl font-semibold text-foreground">Mein Konto</h1>

         <div className="rounded-lg border border-solid border-border bg-surface">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
               <div className="flex items-center gap-4">
                  <Avatar label={avatarLabel} />
                  <div>
                     <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
                     <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
               </div>
               <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Abmelden
               </Button>
            </div>

            <div className="grid gap-3 border-t border-border p-6 sm:grid-cols-2">
               {tiles.map((tile) => (
                  <button
                     key={tile.to}
                     type="button"
                     onClick={() => go(tile.to)}
                     className="flex items-center justify-between gap-3 rounded-lg border border-solid border-border bg-surface p-4 text-left transition-colors hover:border-primary"
                  >
                     <span className="flex items-center gap-3">
                        <span className="text-primary">{tile.icon}</span>
                        <span>
                           <span className="block font-medium text-foreground">{tile.title}</span>
                           <span className="block text-sm text-muted-foreground">{tile.desc}</span>
                        </span>
                     </span>
                     <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
               ))}
            </div>
         </div>
      </div>
   );
};
