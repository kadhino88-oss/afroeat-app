import { apiGet, apiPost, apiPut } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

export const submitPartnerApplication = (application) =>
  apiPost(API_ENDPOINTS.partnerApplications.create(), application, null, {
    timeout: 20000,
    retries: 0,
  });

// Espace administrateur : liste et suivi des demandes de commerces partenaires.
export const getAdminPartnerApplications = (token, status = '') =>
  apiGet(
    `${API_ENDPOINTS.admin.partnerApplications}?limit=100${status ? `&status=${encodeURIComponent(status)}` : ''}`,
    token
  );

export const updatePartnerApplication = (id, payload, token) =>
  apiPut(API_ENDPOINTS.admin.partnerApplicationById(id), payload, token);
