// src/services/userService.ts
import api from './api';
import { User } from '@/type/user';

const userService = {
   // Hole aktuellen User (falls gebraucht)
   me: async (): Promise<User> => {
      const response = await api.get<User>('/users/me');
      return response.data;
   },

   // Update des eingeloggten Users
   update: async (updates: Partial<User>): Promise<User> => {
      console.log(updates);
      const response = await api.put<User>('/users/me', updates);
      return response.data;
   },
   async deleteUser(id?: number): Promise<void> {
      if (id) {
         // Admin löscht einen User
         await api.delete(`/users/${id}`);
      } else {
         // Eingeloggter User löscht sich selbst
         await api.delete(`/users/me`);
      }
   },

   // ✅ Alle User für Admin laden
   getAll: async (): Promise<User[]> => {
      const res = await api.get<User[]>('/users');
      return res.data;
   },
};

export default userService;
