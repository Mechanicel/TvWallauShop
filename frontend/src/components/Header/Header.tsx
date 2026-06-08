// frontend/src/components/Header/Header.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, LayoutDashboard, LogIn, LogOut, ShoppingCart, User } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store';
import { selectAuth, logout } from '@/store/slices/authSlice';
import { ROUTES } from '@/utils/constants';
import { Button } from '@/components/ui/button';

export const Header: React.FC = () => {
   const navigate = useNavigate();
   const dispatch = useAppDispatch();
   const { accessToken, user } = useAppSelector(selectAuth);

   return (
      <header className="tw-scope sticky top-0 z-40 border-b border-solid border-border bg-surface">
         <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <button
               type="button"
               onClick={() => navigate(ROUTES.HOME)}
               className="text-lg font-semibold text-foreground transition-colors hover:text-primary"
            >
               Vereins-Shop
            </button>

            <nav className="flex flex-wrap items-center gap-1">
               <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.HOME)}>
                  <Home className="h-4 w-4" />
                  Shop
               </Button>
               <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.CART)}>
                  <ShoppingCart className="h-4 w-4" />
                  Warenkorb
               </Button>
               {user?.role === 'customer' && (
                  <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.USER_ACCOUNT)}>
                     <User className="h-4 w-4" />
                     Mein Konto
                  </Button>
               )}
               {user?.role === 'admin' && (
                  <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.ADMIN_DASHBOARD)}>
                     <LayoutDashboard className="h-4 w-4" />
                     Dashboard
                  </Button>
               )}
               {accessToken ? (
                  <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => {
                        dispatch(logout());
                        navigate(ROUTES.HOME);
                     }}
                  >
                     <LogOut className="h-4 w-4" />
                     Logout
                  </Button>
               ) : (
                  <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.LOGIN)}>
                     <LogIn className="h-4 w-4" />
                     Login
                  </Button>
               )}
            </nav>
         </div>
      </header>
   );
};
