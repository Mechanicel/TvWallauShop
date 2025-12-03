// frontend/src/store/slices/userSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import userService from '../../services/userService';
import { User } from '../../type/user';
import api from '../../services/api';
import { RootState } from '../index';
import { setUser as setAuthUser } from './authSlice';

interface UserState {
    users: User[];        // Liste aller User für Admin
    user: User | null;    // eingeloggter User (Profil)
    loading: boolean;
    error: string | null;
}

const initialState: UserState = {
    users: [],
    user: null,
    loading: false,
    error: null,
};

/**
 * Normalisiert die API-User-Objekte auf unseren Frontend-User-Typ.
 * -> fängt sowohl snake_case als auch camelCase ab.
 */
const mapApiUserToUser = (raw: any): User => {
    if (!raw) {
        throw new Error('Empty user from API');
    }

    return {
        id: raw.id,
        email: raw.email,
        role: raw.role,
        isVerified: raw.isVerified ?? raw.is_verified ?? false,
        createdAt: raw.createdAt ?? raw.created_at ?? '',

        // Name
        first_name: raw.first_name ?? raw.firstName ?? '',
        last_name: raw.last_name ?? raw.lastName ?? '',

        // Kontakt
        phone: raw.phone ?? null,

        // Rechnungsadresse
        street: raw.street ?? null,
        house_number: raw.house_number ?? raw.houseNumber ?? null,
        postal_code: raw.postal_code ?? raw.postalCode ?? null,
        city: raw.city ?? null,
        country: raw.country ?? null,

        // Lieferadresse
        shippingStreet: raw.shippingStreet ?? raw.shipping_street ?? '',
        shippingHouseNumber:
            raw.shippingHouseNumber ?? raw.shipping_house_number ?? '',
        shippingPostalCode:
            raw.shippingPostalCode ?? raw.shipping_postal_code ?? '',
        shippingCity: raw.shippingCity ?? raw.shipping_city ?? '',
        shippingState: raw.shippingState ?? raw.shipping_state ?? '',
        shippingCountry: raw.shippingCountry ?? raw.shipping_country ?? '',

        // Zahlungsinfo
        preferred_payment:
            raw.preferred_payment ?? raw.preferredPayment ?? undefined,

        // Marketing
        newsletter_opt_in:
            raw.newsletter_opt_in ?? raw.newsletterOptIn ?? false,
        dateOfBirth: raw.dateOfBirth ?? raw.date_of_birth ?? null,
        gender: raw.gender ?? null,

        // Shop-spezifisch
        loyaltyPoints: raw.loyaltyPoints ?? raw.loyalty_points ?? 0,
        lastLogin: raw.lastLogin ?? raw.last_login ?? null,
        accountStatus: raw.accountStatus ?? raw.account_status ?? 'active',
    };
};

// 🔹 eingeloggten User laden
export const fetchUser = createAsyncThunk<any>(
    'user/fetchUser',
    async () => {
        const me = await userService.me();
        return me;
    }
);

// 🔹 alle User für Admin laden
export const fetchUsers = createAsyncThunk<any[]>(
    'user/fetchUsers',
    async () => {
        const all = await userService.getAll();
        return all;
    }
);

// 🔹 eingeloggten User aktualisieren (/users/me)
export const updateUser = createAsyncThunk<
    any,
    Partial<User>,
    { state: RootState }
>(
    'user/update',
    async (updates, { getState, dispatch }) => {
        const updatedRaw = await userService.update(updates);
        const updated = mapApiUserToUser(updatedRaw);

        // Wenn der aktualisierte User der aktuell eingeloggte ist → auch im Auth-Slice updaten
        const authUser = (getState().auth.user);
        if (authUser && authUser.id === updated.id) {
            dispatch(setAuthUser(updated));
        }

        return updatedRaw;
    }
);

// 🔹 Admin: beliebigen User per ID aktualisieren (/users/:id)
export const updateUserById = createAsyncThunk<
    any,
    { id: number; changes: any },
    { state: RootState }
>(
    'user/updateById',
    async ({ id, changes }, { getState, dispatch }) => {
        const res = await api.put(`/users/${id}`, changes);
        const updatedRaw = res.data;
        const updated = mapApiUserToUser(updatedRaw);

        // Falls der aktualisierte User der aktuell eingeloggte ist → Auth-Slice synchronisieren
        const authUser = (getState().auth.user);
        if (authUser && authUser.id === updated.id) {
            dispatch(setAuthUser(updated));
        }

        return updatedRaw;
    }
);

// 🔹 User löschen – mit ID = Admin löscht jemanden, ohne ID = User löscht sich selbst
export const deleteUser = createAsyncThunk<number, number | undefined>(
    'user/deleteUser',
    async (id) => {
        if (id != null) {
            await api.delete(`/users/${id}`);
            return id;
        } else {
            await api.delete(`/users/me`);
            return -1; // eigener Account – im State behandeln wir das separat
        }
    }
);

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        clearUser(state) {
            state.user = null;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchUser
            .addCase(fetchUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(
                fetchUser.fulfilled,
                (state, action: PayloadAction<any>) => {
                    state.loading = false;
                    state.error = null;
                    state.user = mapApiUserToUser(action.payload);
                }
            )
            .addCase(fetchUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message ?? 'Fehler beim Laden';
            })

            // fetchUsers
            .addCase(fetchUsers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(
                fetchUsers.fulfilled,
                (state, action: PayloadAction<any[]>) => {
                    state.loading = false;
                    state.error = null;

                    console.log(
                        '[userSlice] fetchUsers.fulfilled – raw payload:',
                        action.payload
                    );

                    state.users = action.payload.map(mapApiUserToUser);

                    console.log(
                        '[userSlice] fetchUsers.fulfilled – normalized users:',
                        state.users
                    );
                }
            )
            .addCase(fetchUsers.rejected, (state, action) => {
                state.loading = false;
                state.error =
                    action.error.message ?? 'Fehler beim Laden der User';
            })

            // updateUser (eingeloggter User)
            .addCase(
                updateUser.fulfilled,
                (state, action: PayloadAction<any>) => {
                    state.loading = false;
                    state.error = null;
                    state.user = mapApiUserToUser(action.payload);
                }
            )

            // updateUserById (Admin)
            .addCase(
                updateUserById.fulfilled,
                (state, action: PayloadAction<any>) => {
                    state.loading = false;
                    state.error = null;

                    const updated = mapApiUserToUser(action.payload);

                    const idx = state.users.findIndex(
                        (u) => u.id === updated.id
                    );
                    if (idx !== -1) {
                        state.users[idx] = updated;
                    }

                    if (state.user && state.user.id === updated.id) {
                        state.user = updated;
                    }
                }
            )

            // deleteUser
            .addCase(
                deleteUser.fulfilled,
                (state, action: PayloadAction<number>) => {
                    state.loading = false;
                    state.error = null;

                    const deletedId = action.payload;

                    if (deletedId !== -1) {
                        // Admin hat einen anderen User gelöscht
                        state.users = state.users.filter(
                            (u) => u.id !== deletedId
                        );
                    } else {
                        // eigener Account gelöscht
                        state.user = null;
                    }
                }
            );
    },
});

export const { clearUser } = userSlice.actions;
export default userSlice.reducer;
