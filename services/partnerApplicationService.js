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

// Lien d'invitation à usage unique : le partenaire crée lui-même son compte et son mot de passe.
export const createPartnerInvite = (id, token) =>
  apiPost(API_ENDPOINTS.admin.partnerApplicationInvite(id), {}, token);

export const getPartnerInvite = (inviteToken) =>
  apiGet(API_ENDPOINTS.partnerApplications.invite(inviteToken));

export const registerWithPartnerInvite = (inviteToken, payload) =>
  apiPost(API_ENDPOINTS.partnerApplications.inviteRegister(inviteToken), payload, null, {
    timeout: 20000,
    retries: 0,
  });
