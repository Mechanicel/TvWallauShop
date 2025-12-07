// frontend/src/App.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toast } from 'primereact/toast';
import { useAppSelector } from './store';
import { selectAuth } from './store/slices/authSlice';

import { Header } from './components/Header';
import { Footer } from './components/Footer';

import { ProductListPage }   from './pages/Shop/ProductListPage';
import { ProductDetailPage } from './pages/Shop/ProductDetailPage';
import { CartPage }          from './pages/Cart/CartPage';
import { CheckoutPage }      from './pages/Cart/CheckoutPage';
import { LoginPage }         from './pages/Auth/LoginPage';
import { SignupPage }        from './pages/Auth/SignupPage';
import { AdminDashboard }    from './pages/Admin/AdminDashboard';
import { ManageProducts }    from './pages/Admin/Product/ManageProducts';
import { ManageOrders }      from './pages/Admin/Ordner/ManageOrders';
import { ManageUsers }       from './pages/Admin/User/ManageUsers';    // ← neu
import { AccountPage }     from './pages/User/AccountPage';
import { ProfilePage }     from './pages/User/ProfilePage';
import { OrdersPage }      from './pages/User/OrdersPage';
import { OrderDetailPage } from './pages/User/OrderDetailPage';
import { SettingsPage }    from './pages/User/SettingsPage';


import { ROUTES } from './utils/constants';

const App: React.FC = () => {
    const { user } = useAppSelector(selectAuth);

    const requireAdmin = (element: React.ReactNode) => {
        if (!user) {
            return <Navigate to={ROUTES.LOGIN} replace />;
        }
        if (user.role !== 'admin') {
            return <Navigate to={ROUTES.HOME} replace />;
        }
        return element;
    };
    const requireUser = (element: React.ReactNode) => {
        if (!user) {
            return <Navigate to={ROUTES.LOGIN} replace />;
        }
        if (user.role !== 'customer') {
            return <Navigate to={ROUTES.HOME} replace />;
        }
        return element;
    };


    return (
        <>
            <Header />
            <main style={{ minHeight: '80vh' }}>
                <Routes>
                    {/* Öffentliche Routen */}
                    <Route path={ROUTES.HOME}                   element={<ProductListPage />} />
                    <Route path={ROUTES.PRODUCT_DETAIL(':id')}  element={<ProductDetailPage />} />
                    <Route path={ROUTES.CART}                   element={<CartPage />} />
                    <Route path={ROUTES.CHECKOUT}               element={<CheckoutPage />} />
                    <Route path={ROUTES.LOGIN}                  element={<LoginPage />} />
                    <Route path={ROUTES.SIGNUP}                 element={<SignupPage />} />

                    {/* Admin-Routen – nur für user.role==='admin' */}
                    <Route
                        path={ROUTES.ADMIN_DASHBOARD}
                        element={requireAdmin(<AdminDashboard />)}
                    />
                    <Route
                        path={ROUTES.MANAGE_PRODUCTS}
                        element={requireAdmin(<ManageProducts />)}
                    />
                    <Route
                        path={ROUTES.MANAGE_ORDERS}
                        element={requireAdmin(<ManageOrders />)}
                    />
                    <Route
                        path={ROUTES.MANAGE_USERS}               // ← neu
                        element={requireAdmin(<ManageUsers />)} // ← neu
                    />
                    {/* User-Routen – nur für user.role==='customer' */}
                    <Route
                        path={ROUTES.USER_ACCOUNT}
                        element={requireUser(<AccountPage />)}
                    />
                    <Route
                        path={ROUTES.USER_PROFILE}
                        element={requireUser(<ProfilePage />)}
                    />
                    <Route
                        path={ROUTES.USER_ORDERS}
                        element={requireUser(<OrdersPage />)}
                    />
                    <Route
                        path={ROUTES.USER_ORDER_DETAIL(':id')}
                        element={requireUser(<OrderDetailPage />)}
                    />
                    <Route
                        path={ROUTES.USER_SETTINGS}
                        element={requireUser(<SettingsPage />)}
                    />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
                </Routes>
            </main>
            <Footer />
            <Toast />
        </>
    );
};

export default App;
