// frontend/src/pages/Auth/LoginPage.tsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAppDispatch } from '@/store';
import { login } from '@/store/slices/authSlice';
import { ROUTES } from '@/utils/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const LoginPage: React.FC = () => {
   const dispatch = useAppDispatch();
   const navigate = useNavigate();

   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
         const resultAction = await dispatch(login({ email, password }));
         if (login.fulfilled.match(resultAction)) {
            const loggedInUser = resultAction.payload.user;
            navigate(loggedInUser.role === 'admin' ? ROUTES.ADMIN_DASHBOARD : ROUTES.HOME);
         } else {
            const msg = resultAction.payload as string;
            setError(msg || 'Login fehlgeschlagen');
         }
      } catch (err: any) {
         setError(err.message || 'Unerwarteter Fehler');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="tw-scope flex min-h-[70vh] items-center justify-center bg-background px-4 py-10">
         <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
               <CardTitle>Anmelden</CardTitle>
               <CardDescription>Melde dich mit deinem Konto an</CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="email">E-Mail</Label>
                     <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-Mail Adresse"
                        autoComplete="email"
                     />
                  </div>
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="password">Passwort</Label>
                     <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Passwort"
                        autoComplete="current-password"
                     />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full">
                     <LogIn className="h-4 w-4" />
                     {loading ? 'Anmelden …' : 'Login'}
                  </Button>
               </form>
               <p className="mt-4 text-center text-sm text-muted-foreground">
                  Noch keinen Account?{' '}
                  <Link to={ROUTES.SIGNUP} className="font-medium text-primary hover:text-primary-hover">
                     Jetzt registrieren
                  </Link>
               </p>
            </CardContent>
         </Card>
      </div>
   );
};
