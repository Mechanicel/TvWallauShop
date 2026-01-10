// frontend/src/types/user.ts
import type { User } from '@tvwallaushop/contracts';
export type { User } from '@tvwallaushop/contracts';
export interface UserState {
   users: User[]; // Liste aller User für Admin
   user: User | null; // eingeloggter User (Profil)
   loading: boolean;
   error: string | null;
}

export const initialState: UserState = {
   users: [],
   user: null,
   loading: false,
   error: null,
};
