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
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  hasPermission: (permission: Permission, channel?: Channel) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
      hasPermission: (permission, channel = "EMPLOYEE") => {
        const user = get().user;
        if (!user) return false;
        return user.permissions.includes(permission) && user.channels.includes(channel);
      },
    }),
    { name: "hotline-auth" },
  ),
);
