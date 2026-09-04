import { apiGet, apiPost, apiPut } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeRole = (value) => {
  const role = normalizeText(value, 'client').toLowerCase();

  if (role === 'restaurant' || role === 'resto') return 'restaurant';

  if (
    role === 'livreur' ||
    role === 'driver' ||
    role === 'delivery' ||
    role === 'courier'
  ) {
    return 'livreur';
  }

  if (role === 'admin' || role === 'administrator' || role === 'superadmin') {
    return 'admin';
  }

  return 'client';
};

const normalizeAccountStatus = (value, role = 'client') => {
  const status = normalizeText(value).toLowerCase();
  const normalizedRole = normalizeRole(role);

  if (
    status === 'approved' ||
    status === 'validated' ||
    status === 'enabled'
  ) {
    return normalizedRole === 'client' ? 'active' : 'approved';
  }

  if (status === 'active' || status === 'completed') {
    return normalizedRole === 'client' ? 'active' : 'approved';
  }

  if (
    status === 'pending' ||
    status === 'pending_approval' ||
    status === 'pending_verification' ||
    status === 'submitted' ||
    status === 'under_review' ||
    status === 'in_review' ||
    status === 'draft'
  ) {
    return 'pending';
  }

  if (
    status === 'blocked' ||
    status === 'suspended' ||
    status === 'disabled' ||
    status === 'banned'
  ) {
    return 'blocked';
  }

  if (
    status === 'rejected' ||
    status === 'refused' ||
    status === 'denied'
  ) {
    return 'rejected';
  }

  return normalizedRole === 'client' ? 'active' : 'pending';
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
    status === 'documents_pending' ||
    status === 'identity_pending' ||
    status === 'subscription_pending' ||
    status === 'under_review' ||
    status === 'in_review' ||
    status === 'draft' ||
    status === 'started' ||
    status === 'incomplete'
  ) {
    return 'pending';
  }

  if (status === 'rejected') {
    return 'rejected';
  }

  return '';
};

const normalizeObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const sanitizePhone = (value) => {
  return String(value ?? '').replace(/[^\d+]/g, '').trim();
};

const extractUser = (response) => {
  if (response?.user && typeof response.user === 'object') {
    return response.user;
  }

  if (response?.data?.user && typeof response.data.user === 'object') {
    return response.data.user;
  }

  if (response?.account && typeof response.account === 'object') {
    return response.account;
  }

  if (response?.data?.account && typeof response.data.account === 'object') {
    return response.data.account;
  }

  if (
    response?.data &&
    typeof response.data === 'object' &&
    !Array.isArray(response.data)
  ) {
    return response.data;
  }

  if (response && typeof response === 'object' && !Array.isArray(response)) {
    return response;
  }

  return null;
};

const extractToken = (response) => {
  if (typeof response?.token === 'string') return response.token.trim();
  if (typeof response?.accessToken === 'string') return response.accessToken.trim();
  if (typeof response?.data?.token === 'string') return response.data.token.trim();
  if (typeof response?.data?.accessToken === 'string') {
    return response.data.accessToken.trim();
  }

  return '';
};

const normalizeUserShape = (user) => {
  if (!user || typeof user !== 'object') return null;

  const role = normalizeRole(user?.role);

  return {
    ...user,
    _id: user?._id || user?.id || null,
    id: user?.id || user?._id || null,
    name: normalizeText(
      user?.name ||
        `${normalizeText(user?.firstName)} ${normalizeText(user?.lastName)}`
    ),
    firstName: normalizeText(user?.firstName),
    lastName: normalizeText(user?.lastName),
    email: normalizeText(user?.email).toLowerCase(),
    phone: sanitizePhone(user?.phone),
    role,
    accountStatus: normalizeAccountStatus(user?.accountStatus, role),
    onboardingStatus: normalizeOnboardingStatus(user?.onboardingStatus),
  };
};

const ensureValidEmail = (email) => {
  const safeEmail = normalizeText(email).toLowerCase();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail);

  if (!isValid) {
    throw new Error('Adresse email invalide.');
  }

  return safeEmail;
};

const ensureValidPassword = (password) => {
  const safePassword = normalizeText(password);

  if (!safePassword || safePassword.length < 6) {
    throw new Error('Mot de passe invalide.');
  }

  return safePassword;
};

export const loginUser = async ({ email, password, role = 'client' }) => {
  const payload = {
    email: ensureValidEmail(email),
    password: ensureValidPassword(password),
    role: normalizeRole(role),
  };

  const response = await apiPost(API_ENDPOINTS.auth.login, payload);

  const rawUser = extractUser(response);
  const user = normalizeUserShape(rawUser);
  const token = extractToken(response);

  if (!user?._id || !token) {
    throw new Error('Réponse de connexion invalide.');
  }

  const backendRole = normalizeRole(user?.role);

  if (payload.role !== 'admin' && backendRole !== payload.role) {
    throw new Error('Le compte utilisé ne correspond pas au rôle sélectionné.');
  }

  if (payload.role === 'admin' && backendRole !== 'admin') {
    throw new Error("Accès refusé. Cet espace est réservé à l'administration.");
  }

  return {
    ...normalizeObject(response),
    user,
    token,
  };
};

export const registerClient = async (payload = {}) => {
  const firstName = normalizeText(payload?.firstName);
  const lastName = normalizeText(payload?.lastName);

  const body = {
    role: 'client',
    firstName,
    lastName,
    name: normalizeText(`${firstName} ${lastName}`),
    email: ensureValidEmail(payload?.email),
    password: ensureValidPassword(payload?.password),
    phone: sanitizePhone(payload?.phone),
    address: normalizeText(payload?.address),
    accountStatus: 'active',
    onboardingStatus: 'completed',
  };

  return apiPost(API_ENDPOINTS.auth.register, body);
};

export const registerRestaurant = async (payload = {}) => {
  const firstName = normalizeText(payload?.firstName);
  const lastName = normalizeText(payload?.lastName);

  const body = {
    role: 'restaurant',
    firstName,
    lastName,
    name: normalizeText(`${firstName} ${lastName}`),
    email: ensureValidEmail(payload?.email),
    password: ensureValidPassword(payload?.password),
    phone: sanitizePhone(payload?.phone),
    address: normalizeText(payload?.address),
    restaurantName: normalizeText(payload?.restaurantName),
    restaurantLogo: normalizeText(payload?.restaurantLogo),
    siret: normalizeText(payload?.siret),
    identityFront: normalizeText(payload?.identityFront),
    identityBack: normalizeText(payload?.identityBack),
    payoutMethod: normalizeText(payload?.payoutMethod),
    accountStatus: 'pending',
    onboardingStatus: 'pending',
  };

  return apiPost(API_ENDPOINTS.auth.register, body);
};

export const registerDriver = async (payload = {}) => {
  const firstName = normalizeText(payload?.firstName);
  const lastName = normalizeText(payload?.lastName);

  const body = {
    role: 'livreur',
    firstName,
    lastName,
    name: normalizeText(`${firstName} ${lastName}`),
    email: ensureValidEmail(payload?.email),
    password: ensureValidPassword(payload?.password),
    phone: sanitizePhone(payload?.phone),
    address: normalizeText(payload?.address),
    country: normalizeText(payload?.country),
    documentType: normalizeText(payload?.documentType),
    identityFront: normalizeText(payload?.identityFront),
    identityBack: normalizeText(payload?.identityBack),
    selfie: normalizeText(payload?.selfie),
    payoutMethod: normalizeText(payload?.payoutMethod),
    membershipPaymentMethod: normalizeText(payload?.membershipPaymentMethod),
    accountStatus: 'pending',
    onboardingStatus: 'pending',
  };

  return apiPost(API_ENDPOINTS.auth.register, body);
};

export const getMyProfile = async (token) => {
  const response = await apiGet(API_ENDPOINTS.auth.me, token);
  const user = normalizeUserShape(extractUser(response));

  if (!user?._id) {
    throw new Error('Impossible de récupérer le profil utilisateur.');
  }

  return {
    ...normalizeObject(response),
    user,
  };
};

export const updateMyProfile = async (payload = {}, token) => {
  const response = await apiPut(API_ENDPOINTS.auth.me, payload, token);
  const user = normalizeUserShape(extractUser(response));

  if (!user?._id) {
    throw new Error('Réponse invalide lors de la mise à jour du profil.');
  }

  return {
    ...normalizeObject(response),
    user,
  };
};