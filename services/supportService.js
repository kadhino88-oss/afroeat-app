import { apiGet, apiPatch, apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

const ticketCollection = API_ENDPOINTS.support.tickets;

export const createSupportTicket = (payload, token) =>
  apiPost(API_ENDPOINTS.support.create, payload, token);

export const getMySupportTickets = (token) =>
  apiGet(`${ticketCollection}/mine?limit=50`, token);

export const getAdminSupportTickets = (token) =>
  apiGet(`${ticketCollection}?limit=100`, token);

export const updateSupportTicket = (ticketId, payload, token) =>
  apiPatch(`${ticketCollection}/${encodeURIComponent(ticketId)}`, payload, token);
