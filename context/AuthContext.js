import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setUnauthorizedHandler } from '../services/apiClient';
import { getMyProfile } from '../services/authService';
import {
  clearAppStorage,
  classifyRevalidationError,
  mergeServerProfile,
} from '../services/sessionPolicy';

const AuthContext = createContext(null);

/**
 * =========================================================
 * STORAGE
 * =========================================================
 */

const STORAGE_KEYS = {
  user: '@afroeat_user',
  token: '@afroeat_token',
  selectedRole: '@afroeat_selected_role',
};

const AUTH_STORAGE_TIMEOUT_MS = 5000;

const withTimeout = (promise, timeoutMs) => {
  let timeoutId;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Le stockage de la session ne répond pas.')),
        timeoutMs
      );
    }),
  ]).finally(() => clearTimeout(timeoutId));
};

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeRole = (value) => {
  const role = normalizeText(value).toLowerCase();

  if (
    role === 'restaurant' ||
    role === 'resto' ||
    role === 'partner_restaurant'
  ) {
    return 'restaurant';
  }

  if (
    role === 'livreur' ||
    role === 'driver' ||
    role === 'delivery' ||
    role === 'courier'
  ) {
    return 'livreur';
  }

  if (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'ops' ||
    role === 'superadmin' ||
    role === 'super-admin'
  ) {
    return 'admin';
  }

  return 'client';
};

const normalizeAccountStatus = (value, role = 'client') => {
  const status = normalizeText(value).toLowerCase();
  const safeRole = normalizeRole(role);

  if (
    status === 'approved' ||
    status === 'active' ||
    status === 'validated' ||
    status === 'enabled' ||
    status === 'completed'
  ) {
    return safeRole === 'client' ? 'active' : 'approved';
  }

  if (
    status === 'pending' ||
    status === 'pending_approval' ||
    status === 'pending-verification' ||
    status === 'pending_verification' ||
    status === 'under_review' ||
    status === 'in_review' ||
    status === 'review' ||
    status === 'submitted' ||
    status === 'draft'
  ) {
    return 'pending';
  }

  if (
    status === 'rejected' ||
    status === 'refused' ||
    status === 'denied'
  ) {
    return 'rejected';
  }

  if (
    status === 'blocked' ||
    status === 'suspended' ||
    status === 'disabled' ||
    status === 'banned'
  ) {
    return 'blocked';
  }

  return safeRole === 'client' ? 'active' : 'pending';
};

const normalizeOnboardingStatus = (value) => {
  const status = normalizeText(value).toLowerCase();

  if (
    status === 'completed' ||
    status === 'complete' ||
    status === 'done' ||
    status === 'approved'
  ) {
    return 'completed';
  }

  if (
    status === 'pending' ||
    status === 'incomplete' ||
    status === 'draft' ||
    status === 'started'
  ) {
    return 'pending';
  }

  if (status === 'rejected') {
    return 'rejected';
  }

  return '';
};

const normalizeUser = (userData) => {
  if (!userData || typeof userData !== 'object') return null;

  const role = normalizeRole(
    userData?.role ||
      userData?.userRole ||
      userData?.accountType
  );

  return {
    ...userData,
    _id: userData?._id || userData?.id || null,
    id: userData?.id || userData?._id || null,
    name: normalizeText(userData?.name || userData?.fullName),
    firstName: normalizeText(userData?.firstName),
    lastName: normalizeText(userData?.lastName),
    email: normalizeText(userData?.email).toLowerCase(),
    phone: normalizeText(userData?.phone),
    address: normalizeText(
      userData?.address ||
        userData?.adresse ||
        userData?.deliveryAddress ||
        userData?.profile?.address
    ),
    role,
    accountStatus: normalizeAccountStatus(
      userData?.accountStatus ||
        userData?.status ||
        userData?.approvalStatus,
      role
    ),
    onboardingStatus: normalizeOnboardingStatus(userData?.onboardingStatus),
  };
};

const normalizeToken = (token) => {
  return typeof token === 'string' ? token.trim() : '';
};

const getDefaultRouteByRole = (role, accountStatus = 'active') => {
  if (role === 'restaurant') {
    return accountStatus === 'approved'
      ? '/restaurant/RestaurantDashboard'
      : '/auth/pending-approval';
  }

  if (role === 'livreur') {
    return accountStatus === 'approved'
      ? '/livraison'
      : '/auth/pending-approval';
  }

  if (role === 'admin') {
    return '/admin';
  }

  return '/explore';
};

/**
 * =========================================================
 * PROVIDER
 * =========================================================
 */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [selectedRole, setSelectedRoleState] = useState('client');
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null);

  /**
   * =========================================================
   * INTERNAL RESET
   * =========================================================
   */

  const resetLocalState = useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    setToken(null);
    setSelectedRoleState('client');
  }, []);

  const clearStoredSession = useCallback(async () => {
    try {
      await clearAppStorage(AsyncStorage);
    } catch (error) {
      console.log('Erreur clearStoredSession:', error);
    }
  }, []);

  /**
   * =========================================================
   * INIT SESSION
   * =========================================================
   */

  // Rafraîchit rôle et accountStatus via GET /users/me. 401 => déconnexion ;
  // erreur réseau/serveur => on garde l'état local sans bloquer l'utilisateur.
  const revalidateSession = useCallback(
    async (sessionToken, localUser) => {
      try {
        const profile = await getMyProfile(sessionToken);
        if (tokenRef.current !== sessionToken) return;

        const merged = normalizeUser(mergeServerProfile(localUser, profile?.user));
        if (!merged?._id) return;

        await AsyncStorage.multiSet([
          [STORAGE_KEYS.user, JSON.stringify(merged)],
          [STORAGE_KEYS.selectedRole, normalizeRole(merged.role)],
        ]);
        if (tokenRef.current !== sessionToken) return;

        setUser(merged);
        setSelectedRoleState(normalizeRole(merged.role));
      } catch (error) {
        if (
          tokenRef.current === sessionToken &&
          classifyRevalidationError(error) === 'unauthorized'
        ) {
          await clearStoredSession();
          resetLocalState();
        }
      }
    },
    [clearStoredSession, resetLocalState]
  );

  const hydrateAuth = useCallback(async () => {
    try {
      setLoading(true);

      const entries = await withTimeout(
        AsyncStorage.multiGet([
          STORAGE_KEYS.user,
          STORAGE_KEYS.token,
          STORAGE_KEYS.selectedRole,
        ]),
        AUTH_STORAGE_TIMEOUT_MS
      );

      const storedUser = entries[0]?.[1];
      const storedToken = entries[1]?.[1];
      const storedSelectedRole = entries[2]?.[1];

      const safeSelectedRole = normalizeRole(storedSelectedRole || 'client');
      setSelectedRoleState(safeSelectedRole);

      if (!storedUser || !storedToken) {
        setUser(null);
        setToken(null);
        return;
      }

      let parsedUser = null;

      try {
        parsedUser = JSON.parse(storedUser);
      } catch (parseError) {
        console.log('Erreur parse storedUser:', parseError);
        void clearStoredSession();
        resetLocalState();
        return;
      }

      const safeUser = normalizeUser(parsedUser);
      const safeToken = normalizeToken(storedToken);

      if (!safeUser?._id || !safeToken) {
        void clearStoredSession();
        resetLocalState();
        return;
      }

      tokenRef.current = safeToken;
      setUser(safeUser);
      setToken(safeToken);
      setSelectedRoleState(normalizeRole(safeUser.role || safeSelectedRole));

      // Revalidation en arrière-plan : rôle / statut du compte viennent du serveur.
      void revalidateSession(safeToken, safeUser);
    } catch (error) {
      console.log('Erreur hydrateAuth:', error);
      // L'application doit rester utilisable même si le stockage du navigateur
      // est bloqué ou ne répond plus (navigation privée, quota ou extension).
      void clearStoredSession();
      resetLocalState();
    } finally {
      setLoading(false);
    }
  }, [clearStoredSession, resetLocalState, revalidateSession]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void hydrateAuth();
    }, 0);
    return () => clearTimeout(timer);
  }, [hydrateAuth]);

  /**
   * =========================================================
   * ACTIONS
   * =========================================================
   */

  const setSelectedRole = useCallback(async (roleValue) => {
    try {
      const safeRole = normalizeRole(roleValue);

      await AsyncStorage.setItem(STORAGE_KEYS.selectedRole, safeRole);
      setSelectedRoleState(safeRole);

      return true;
    } catch (error) {
      console.log('Erreur setSelectedRole:', error);
      return false;
    }
  }, []);

  const login = useCallback(async (userData, tokenData) => {
    try {
      const safeUser = normalizeUser(userData);
      const safeToken = normalizeToken(tokenData);

      if (!safeUser?._id || !safeToken) {
        return false;
      }

      const safeRole = normalizeRole(safeUser.role);

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.user, JSON.stringify(safeUser)],
        [STORAGE_KEYS.token, safeToken],
        [STORAGE_KEYS.selectedRole, safeRole],
      ]);

      tokenRef.current = safeToken;
      setUser(safeUser);
      setToken(safeToken);
      setSelectedRoleState(safeRole);

      return true;
    } catch (error) {
      console.log('Erreur login:', error);
      return false;
    }
  }, []);

  const updateUser = useCallback(
    async (nextUserData) => {
      try {
        const mergedUser = normalizeUser({
          ...(user || {}),
          ...(nextUserData || {}),
        });

        if (!mergedUser?._id) {
          return false;
        }

        await AsyncStorage.multiSet([
          [STORAGE_KEYS.user, JSON.stringify(mergedUser)],
          [STORAGE_KEYS.selectedRole, normalizeRole(mergedUser.role)],
        ]);

        setUser(mergedUser);
        setSelectedRoleState(normalizeRole(mergedUser.role));

        return true;
      } catch (error) {
        console.log('Erreur updateUser:', error);
        return false;
      }
    },
    [user]
  );

  // Pas d'appel serveur de déconnexion : /users/logout n'existe pas côté backend
  // (jeton JWT sans état). Le nettoyage local complet est la déconnexion.
  const logout = useCallback(async () => {
    try {
      await clearAppStorage(AsyncStorage);

      resetLocalState();

      return true;
    } catch (error) {
      console.log('Erreur logout:', error);
      return false;
    }
  }, [resetLocalState]);

  // Session refusée par le serveur (jeton expiré ou invalide) : déconnexion automatique,
  // les écrans protégés renvoient alors d'eux-mêmes vers la connexion.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  /**
   * Reset total demandé :
   * - session
   * - rôle sélectionné
   * - panier local
   * - autres traces locales app
   */
  const clearAllLocalAppData = useCallback(async () => {
    try {
      await clearAppStorage(AsyncStorage);
      resetLocalState();
      return true;
    } catch (error) {
      console.log('Erreur clearAllLocalAppData:', error);
      return false;
    }
  }, [resetLocalState]);

  /**
   * =========================================================
   * DERIVED
   * =========================================================
   */

  const isAuthenticated = useMemo(() => {
    return Boolean(user?._id && token);
  }, [user, token]);

  /**
   * IMPORTANT :
   * - si connecté => on prend SEULEMENT le rôle du user
   * - si non connecté => on utilise selectedRole uniquement pour le flow auth
   */
  const role = useMemo(() => {
    if (isAuthenticated && user?.role) {
      return normalizeRole(user.role);
    }

    return normalizeRole(selectedRole || 'client');
  }, [isAuthenticated, user, selectedRole]);

  const accountStatus = useMemo(() => {
    if (isAuthenticated && user) {
      return normalizeAccountStatus(
        user?.accountStatus || user?.status || user?.approvalStatus,
        role
      );
    }

    return role === 'client' ? 'active' : 'pending';
  }, [isAuthenticated, user, role]);

  const onboardingStatus = useMemo(() => {
    return normalizeOnboardingStatus(user?.onboardingStatus);
  }, [user]);

  const isClient = role === 'client';
  const isRestaurant = role === 'restaurant';
  const isDriver = role === 'livreur';
  const isAdmin = role === 'admin';

  const isPendingApproval = useMemo(() => {
    if (!isAuthenticated) return false;
    if (isClient || isAdmin) return false;
    return accountStatus === 'pending';
  }, [isAuthenticated, isClient, isAdmin, accountStatus]);

  const isApproved = useMemo(() => {
    if (!isAuthenticated) return false;
    if (isClient) return true;
    if (isAdmin) return true;
    return accountStatus === 'approved';
  }, [isAuthenticated, isClient, isAdmin, accountStatus]);

  const homeRoute = useMemo(() => {
    if (!isAuthenticated) {
      return '/(tabs)';
    }

    return getDefaultRouteByRole(role, accountStatus);
  }, [isAuthenticated, role, accountStatus]);

  /**
   * =========================================================
   * VALUE
   * =========================================================
   */

  const value = useMemo(() => {
    return {
      user,
      token,
      role,
      selectedRole,
      accountStatus,
      onboardingStatus,
      loading,
      isAuthenticated,
      isClient,
      isRestaurant,
      isDriver,
      isAdmin,
      isPendingApproval,
      isApproved,
      homeRoute,
      login,
      logout,
      updateUser,
      setSelectedRole,
      refreshAuth: hydrateAuth,
      clearAllLocalAppData,
    };
  }, [
    user,
    token,
    role,
    selectedRole,
    accountStatus,
    onboardingStatus,
    loading,
    isAuthenticated,
    isClient,
    isRestaurant,
    isDriver,
    isAdmin,
    isPendingApproval,
    isApproved,
    homeRoute,
    login,
    logout,
    updateUser,
    setSelectedRole,
    hydrateAuth,
    clearAllLocalAppData,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * =========================================================
 * HOOK
 * =========================================================
 */

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }

  return context;
}
