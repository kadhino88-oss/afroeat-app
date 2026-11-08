import { apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

export const submitPartnerApplication = (application) =>
  apiPost(API_ENDPOINTS.partnerApplications.create(), application, null, {
    timeout: 20000,
    retries: 0,
  });
