import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, Permission } from "@hotline/shared";

export interface AuthUser {
  id: string;
  fullName: string;
  roleNames: string[];
  permissions: Permission[];
  channels: Channel[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** Какой канал сейчас выбран в переключателе (Sidebar) — Фаза 7, PLAN.md §6.
   * Персистится вместе с остальным auth-стейтом, чтобы не сбрасывался между визитами. */
  activeChannel: Channel;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser | null) => void;
  setActiveChannel: (channel: Channel) => void;
  logout: () => void;
  hasPermission: (permission: Permission, channel?: Channel) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      activeChannel: "EMPLOYEE",
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => {
        // Если у пользователя нет доступа к текущему выбранному каналу (например,
        // «Продажи» — только CUSTOMER), переключаемся на первый реально доступный —
        // иначе все страницы молча показывали бы пусто/403 после каждого логина.
        const current = get().activeChannel;
        const activeChannel = user && !user.channels.includes(current) ? (user.channels[0] ?? current) : current;
        set({ user, activeChannel });
      },
      setActiveChannel: (channel) => set({ activeChannel: channel }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
      // Дефолт канала — activeChannel, а не жёстко EMPLOYEE: иначе роль «Продажи»
      // (только CUSTOMER) проваливала бы вообще все hasPermission(...)-проверки без
      // явного channel-аргумента — Sidebar/RequirePermission/AppealDetailPage и т.п.
      // Явный channel-аргумент (когда он передан) по-прежнему в приоритете.
      hasPermission: (permission, channel) => {
        const user = get().user;
        if (!user) return false;
        return user.permissions.includes(permission) && user.channels.includes(channel ?? get().activeChannel);
      },
    }),
    { name: "hotline-auth" },
  ),
);
