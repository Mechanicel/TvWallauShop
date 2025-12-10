// frontend/src/store/slices/authSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import authService, {
  LoginCredentials,
  SignupPayload,
  AuthResponse,
} from '../../services/authService';
import { User } from '../../type/user';

/**
 * Auth-Status für die App.
 * accessToken: aktueller JWT für API-Calls
 * user: eingeloggter User
 * loading / error: Status für Thunks
 * isInitialized: ob wir schon einmal versucht haben, einen Persistenz-Status herzustellen
 */
export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  isInitialized: boolean;
}

/**
 * Hilfsfunktionen zum Lesen/Schreiben aus localStorage.
 * Wir persistieren optional accessToken und user.
 * (Für maximale Sicherheit könnte man das später auch komplett in Memory halten.)
 */
function loadInitialAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
}

function loadInitialUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  accessToken: loadInitialAccessToken(),
  user: loadInitialUser(),
  loading: false,
  error: null,
  isInitialized: true, // wir haben beim Laden schon versucht, aus localStorage zu ziehen
};

/**
 * Login-Thunk:
 * - schickt Credentials an /auth/login
 * - erwartet { accessToken, user } vom Backend
 * - speichert accessToken & user im State und optional in localStorage
 */
export const login = createAsyncThunk<
  AuthResponse,
  LoginCredentials,
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const data = await authService.login(credentials);
    return data;
  } catch (error: any) {
    const message =
      error?.response?.data?.error || error?.message || 'Login fehlgeschlagen';
    return rejectWithValue(message);
  }
});

/**
 * Signup-Thunk:
 * - schickt Registrierungsdaten an /auth/signup
 * - loggt den User NICHT automatisch ein (kannst du bei Bedarf anpassen)
 */
export const signup = createAsyncThunk<
  void,
  SignupPayload,
  { rejectValue: string }
>('auth/signup', async (payload, { rejectWithValue }) => {
  try {
    await authService.signup(payload);
  } catch (error: any) {
    const message =
      error?.response?.data?.error ||
      error?.message ||
      'Registrierung fehlgeschlagen';
    return rejectWithValue(message);
  }
});

/**
 * Logout-Thunk:
 * - ruft /auth/logout auf
 * - leert den Auth-State und localStorage
 */
export const logout = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Logout fehlgeschlagen';
      return rejectWithValue(message);
    }
  },
);

/**
 * Optionaler Refresh-Thunk:
 * - holt einen neuen Access-Token via /auth/refresh
 * - nutzt dafür nur das httpOnly-Refresh-Cookie (kein Token im Body)
 * - Kann z.B. vom Axios-Interceptor oder beim App-Start verwendet werden
 */
export const refreshAccessToken = createAsyncThunk<
  AuthResponse,
  void,
  { rejectValue: string }
>('auth/refresh', async (_, { rejectWithValue }) => {
  try {
    const data = await authService.refresh();
    return data;
  } catch (error: any) {
    const message =
      error?.response?.data?.error ||
      error?.message ||
      'Token-Refresh fehlgeschlagen';
    return rejectWithValue(message);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Setzt den Access-Token manuell (z.B. nach einem Refresh oder aus einem Interceptor).
     */
    setAccessToken(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload ?? null;

      if (typeof window === 'undefined') return;

      try {
        if (action.payload) {
          localStorage.setItem('accessToken', action.payload);
        } else {
          localStorage.removeItem('accessToken');
        }
      } catch {
        // ignorieren – localStorage ist nur ein Komfort-Feature
      }
    },
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;

      if (typeof window !== 'undefined') {
        try {
          if (action.payload) {
            localStorage.setItem('user', JSON.stringify(action.payload));
          } else {
            localStorage.removeItem('user');
          }
        } catch {
          // ignorieren
        }
      }
    },
    /**
     * Löscht alle Auth-Daten aus dem State (z.B. on logout / token error).
     */
    clearAuth(state) {
      state.accessToken = null;
      state.user = null;
      state.error = null;

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        } catch {
          // ignorieren
        }
      }
    },
  },
  extraReducers: (builder) => {
    // LOGIN
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('accessToken', action.payload.accessToken);
            localStorage.setItem('user', JSON.stringify(action.payload.user));
          } catch {
            // ignorieren
          }
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Login fehlgeschlagen';
      });

    // SIGNUP
    builder
      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state) => {
        state.loading = false;
        // optional: Erfolgszustand setzen
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Registrierung fehlgeschlagen';
      });

    // LOGOUT
    builder
      .addCase(logout.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.accessToken = null;
        state.user = null;

        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
          } catch {
            // ignorieren
          }
        }
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Logout fehlgeschlagen';
      });

    // REFRESH
    builder
      .addCase(refreshAccessToken.pending, (state) => {
        // kein hartes loading notwendig, damit UI nicht flackert
        state.error = null;
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('accessToken', action.payload.accessToken);
            localStorage.setItem('user', JSON.stringify(action.payload.user));
          } catch {
            // ignorieren
          }
        }
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        // Wenn Refresh fehlschlägt → User ist effektiv ausgeloggt
        state.accessToken = null;
        state.user = null;
        state.error = action.payload || 'Token-Refresh fehlgeschlagen';

        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
          } catch {
            // ignorieren
          }
        }
      });
  },
});

export const { setAccessToken, clearAuth, setUser } = authSlice.actions;
export const selectAuth = (state: RootState) => state.auth;
export default authSlice.reducer;
