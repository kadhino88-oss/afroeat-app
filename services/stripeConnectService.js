import { apiGet, apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

export const getStripeConnectStatus = (token) =>
  apiGet(API_ENDPOINTS.payments.connectStatus, token);

export const createStripeConnectOnboardingLink = (countryCode, token) =>
  apiPost(
    API_ENDPOINTS.payments.connectOnboardingLink,
    { countryCode: String(countryCode || '').trim().toUpperCase() },
    token
  );

export const createStripeConnectDashboardLink = (token) =>
  apiPost(API_ENDPOINTS.payments.connectDashboardLink, {}, token);

export const getPayoutReconciliation = (token) =>
  apiGet(API_ENDPOINTS.payments.connectReconciliation, token);

export const retryPayoutReconciliation = (orderId, token) =>
  apiPost(API_ENDPOINTS.payments.connectReconcile(orderId), {}, token);

export const resolvePayoutReconciliation = (orderId, note, token) =>
  apiPost(
    API_ENDPOINTS.payments.connectResolveReconciliation(orderId),
    { note: String(note || '').trim() },
    token
  );
