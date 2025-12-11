// frontend/src/components/Header.tsx

import React from 'react';
import { Menubar } from 'primereact/menubar';
import { Button } from 'primereact/button';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/store';
import { selectAuth, logout } from '@/store/slices/authSlice';
import { ROUTES } from '@/utils/constants';

export const Header: React.FC = () => {
   const navigate = useNavigate();
   const dispatch = useAppDispatch();
   const { accessToken, user } = useAppSelector(selectAuth);

   const start = (
      <h1 className="p-text-bold" style={{ cursor: 'pointer', margin: 0 }} onClick={() => navigate(ROUTES.HOME)}>
         Vereins-Shop
      </h1>
   );

   const end = (
      <>
         <Button
            label="Shop"
            icon="pi pi-home"
            className="p-button-text p-mr-2"
            onClick={() => navigate(ROUTES.HOME)}
         />
         <Button
            label="Warenkorb"
            icon="pi pi-shopping-cart"
            className="p-button-text p-mr-2"
            onClick={() => navigate(ROUTES.CART)}
         />
         {user?.role === 'customer' && (
            <Button
               label="Mein Konto"
               icon="pi pi-user"
               className="p-button-text p-mr-2"
               onClick={() => navigate(ROUTES.USER_ACCOUNT)}
            />
         )}
         {user?.role === 'admin' && (
            <Button
               label="Dashboard"
               icon="pi pi-chart-line"
               className="p-button-text p-mr-2"
               onClick={() => navigate(ROUTES.ADMIN_DASHBOARD)}
            />
         )}
         {accessToken ? (
            <Button
               label="Logout"
               icon="pi pi-sign-out"
               className="p-button-text"
               onClick={() => {
                  dispatch(logout());
                  navigate(ROUTES.HOME);
               }}
            />
         ) : (
            <Button label="Login" icon="pi pi-user" className="p-button-text" onClick={() => navigate(ROUTES.LOGIN)} />
         )}
      </>
   );

   return <Menubar start={start} end={end} />;
};
