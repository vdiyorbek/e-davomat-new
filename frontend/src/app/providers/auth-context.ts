import { createContext } from "react";
import type { Session } from "@/types/auth";

export interface AuthContextValue {
  session: Session | null;
  notice: string;
  signIn: (login: string, password: string) => Promise<void>;
  logout: (message?: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
