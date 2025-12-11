import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { selectAuth } from '@/store/slices/authSlice';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { Avatar } from 'primereact/avatar';
import './AccountPage.css';

export const AccountPage: React.FC = () => {
   const { user } = useAppSelector(selectAuth);
   const navigate = useNavigate();

   if (!user) return <p>Bitte einloggen.</p>;

   return (
      <div className="account-page">
         <Card className="account-card">
            <div className="account-header">
               <Avatar
                  label={user.first_name ? user.first_name[0].toUpperCase() : '?'}
                  size="xlarge"
                  className="account-avatar"
               />
               <div>
                  <h2>
                     {user.first_name} {user.last_name}
                  </h2>
                  <p className="account-email">{user.email}</p>
               </div>
            </div>

            <Divider />

            <div className="account-actions">
               <Button
                  label="Meine Daten"
                  icon="pi pi-user"
                  className="account-btn"
                  onClick={() => navigate('/user/profile')}
               />
               <Button
                  label="Meine Bestellungen"
                  icon="pi pi-shopping-cart"
                  className="account-btn"
                  onClick={() => navigate('/user/orders')}
               />
               <Button
                  label="Einstellungen"
                  icon="pi pi-cog"
                  className="account-btn"
                  onClick={() => navigate('/user/settings')}
               />
            </div>
         </Card>
      </div>
   );
};
