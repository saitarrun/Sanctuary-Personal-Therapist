"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface User {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}

interface AuthState {
  isLoading: boolean;
  user: User | null;
  isAuthenticated: boolean;
  error: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    user: null,
    isAuthenticated: false,
    error: null,
    accessToken: null,
    refreshToken: null,
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  const scheduleTokenRefresh = useCallback((expiresIn: number) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Refresh 1 minute before expiration
    const refreshIn = Math.max(expiresIn - 60, 0) * 1000;

    refreshTimeoutRef.current = setTimeout(() => {
      refreshAccessToken();
    }, refreshIn);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");

      if (!response.ok) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          user: null,
        }));
        return;
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: true,
        user: data.user,
      }));
    } catch (error) {
      console.error("[useAuth] Failed to check auth status:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
      }));
    }
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: data.error || "Login failed",
          }));
          return { success: false, error: data.error };
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: true,
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }));

        scheduleTokenRefresh(data.expiresIn);

        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Login failed";
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return { success: false, error: message };
      }
    },
    [scheduleTokenRefresh]
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      firstName?: string,
      lastName?: string
    ): Promise<{ success: boolean; error?: string }> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            firstName,
            lastName,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: data.error || "Signup failed",
          }));
          return { success: false, error: data.error };
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          user: data.user,
        }));

        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Signup failed";
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return { success: false, error: message };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("[useAuth] Logout error:", error);
    }

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    setState({
      isLoading: false,
      user: null,
      isAuthenticated: false,
      error: null,
      accessToken: null,
      refreshToken: null,
    });
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!state.refreshToken) return;

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: state.refreshToken }),
      });

      if (!response.ok) {
        await logout();
        return;
      }

      const data = await response.json();

      setState((prev) => ({
        ...prev,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }));

      scheduleTokenRefresh(data.expiresIn);
    } catch (error) {
      console.error("[useAuth] Token refresh failed:", error);
      await logout();
    }
  }, [state.refreshToken, logout, scheduleTokenRefresh]);

  useEffect(() => {
    checkAuthStatus();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [checkAuthStatus]);

  return {
    ...state,
    login,
    signup,
    logout,
    refreshAccessToken,
  };
}
