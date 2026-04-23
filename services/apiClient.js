import { API_BASE_URL, API_CONFIG } from '../constants/api';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const DEFAULT_TIMEOUT = API_CONFIG?.timeout || 15000;

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeBaseUrl = (url) => {
  return String(url ?? '').replace(/\/+$/, '');
};

const normalizeEndpoint = (endpoint) => {
  const value = String(endpoint ?? '').trim();

  if (!value) {
    return '';
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return value.startsWith('/') ? value : `/${value}`;
};

const buildUrl = (endpoint) => {
  const cleanEndpoint = normalizeEndpoint(endpoint);

  if (!cleanEndpoint) {
    throw new Error('Endpoint API introuvable ou invalide.');
  }

  if (
    cleanEndpoint.startsWith('http://') ||
    cleanEndpoint.startsWith('https://')
  ) {
    return cleanEndpoint;
  }

  const baseUrl = normalizeBaseUrl(API_BASE_URL);

  if (!baseUrl) {
    throw new Error('API_BASE_URL est introuvable ou invalide.');
  }

  return `${baseUrl}${cleanEndpoint}`;
};

const normalizeToken = (token) => {
  if (typeof token === 'string') {
    const normalized = token.trim();
    return normalized || null;
  }

  if (token && typeof token === 'object') {
    const nestedToken =
      token?.token ||
      token?.accessToken ||
      token?.access_token ||
      token?.jwt ||
      '';

    const normalized = String(nestedToken ?? '').trim();
    return normalized || null;
  }

  return null;
};

const buildHeaders = (token = null, isJson = true, customHeaders = {}) => {
  const headers = {
    Accept: 'application/json',
    ...customHeaders,
  };

  const contentType = headers['Content-Type'];
  const hasCustomContentType =
    typeof contentType === 'string' && contentType.trim().length > 0;

  const isMultipart =
    hasCustomContentType &&
    String(contentType).toLowerCase() === 'multipart/form-data';

  if (isMultipart) {
    delete headers['Content-Type'];
  } else if (isJson && !hasCustomContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const normalizedToken = normalizeToken(token);

  if (normalizedToken) {
    headers.Authorization = `Bearer ${normalizedToken}`;
  }

  return headers;
};

const createTimeoutSignal = (timeoutMs = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
};

const parseResponseBody = async (response) => {
  const contentType = response?.headers?.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
};

const extractErrorMessage = (response, data) => {
  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }

    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }

    if (typeof data.details === 'string' && data.details.trim()) {
      return data.details.trim();
    }

    if (typeof data.errors === 'string' && data.errors.trim()) {
      return data.errors.trim();
    }

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const firstError = data.errors.find(
        (item) => typeof item === 'string' && item.trim()
      );

      if (firstError) {
        return firstError.trim();
      }
    }
  }

  switch (response?.status) {
    case 400:
      return 'Requête invalide.';
    case 401:
      return 'Session expirée ou accès non autorisé.';
    case 403:
      return 'Accès refusé.';
    case 404:
      return 'Ressource introuvable.';
    case 409:
      return 'Conflit détecté.';
    case 422:
      return 'Données invalides.';
    case 429:
      return 'Trop de requêtes. Réessaie plus tard.';
    case 500:
      return 'Erreur interne du serveur.';
    case 502:
      return 'Serveur temporairement indisponible.';
    case 503:
      return 'Service indisponible.';
    case 504:
      return 'Le serveur met trop de temps à répondre.';
    default:
      return `Erreur API (${response?.status || 'inconnue'})`;
  }
};

const normalizeSuccessResponse = (data, response) => {
  if (data === null || data === undefined || data === '') {
    return {
      success: true,
      status: response?.status || 200,
    };
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    return {
      ...data,
      success: typeof data.success === 'boolean' ? data.success : true,
      status: Number.isFinite(Number(data.status))
        ? Number(data.status)
        : response?.status || 200,
    };
  }

  return data;
};

const handleResponse = async (response) => {
  const data = await parseResponseBody(response);

  if (!response.ok) {
    const message = extractErrorMessage(response, data);
    const error = new Error(message);

    error.status = response.status;
    error.data = data;
    error.response = response;

    throw error;
  }

  return normalizeSuccessResponse(data, response);
};

const request = async (
  method,
  endpoint,
  {
    body = null,
    token = null,
    isJson = true,
    headers = {},
    timeout = DEFAULT_TIMEOUT,
  } = {}
) => {
  const url = buildUrl(endpoint);
  const { signal, clear } = createTimeoutSignal(timeout);

  try {
    const options = {
      method,
      headers: buildHeaders(token, isJson, headers),
      signal,
    };

    if (body !== null && body !== undefined) {
      options.body = isJson ? JSON.stringify(body) : body;
    }

    const response = await fetch(url, options);
    return await handleResponse(response);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('La requête a expiré. Vérifie ta connexion et réessaie.');
    }

    if (
      error?.message === 'Network request failed' ||
      error?.message?.toLowerCase?.().includes('network') ||
      error?.message?.toLowerCase?.().includes('failed to fetch')
    ) {
      throw new Error(
        'Impossible de contacter le serveur. Vérifie ta connexion.'
      );
    }

    throw error;
  } finally {
    clear();
  }
};

/**
 * =========================================================
 * PUBLIC API
 * =========================================================
 */

export const apiRequest = async (method, endpoint, options = {}) => {
  return request(method, endpoint, options);
};

export const apiGet = async (endpoint, token = null, options = {}) => {
  return request('GET', endpoint, {
    token,
    isJson: false,
    ...options,
  });
};

export const apiPost = async (
  endpoint,
  body = {},
  token = null,
  options = {}
) => {
  return request('POST', endpoint, {
    body,
    token,
    isJson: true,
    ...options,
  });
};

export const apiPut = async (
  endpoint,
  body = {},
  token = null,
  options = {}
) => {
  return request('PUT', endpoint, {
    body,
    token,
    isJson: true,
    ...options,
  });
};

export const apiPatch = async (
  endpoint,
  body = {},
  token = null,
  options = {}
) => {
  return request('PATCH', endpoint, {
    body,
    token,
    isJson: true,
    ...options,
  });
};

export const apiDelete = async (endpoint, token = null, options = {}) => {
  return request('DELETE', endpoint, {
    token,
    isJson: false,
    ...options,
  });
};

export const apiUpload = async (
  endpoint,
  formData,
  token = null,
  options = {}
) => {
  return request('POST', endpoint, {
    body: formData,
    token,
    isJson: false,
    ...options,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(options.headers || {}),
    },
  });
};