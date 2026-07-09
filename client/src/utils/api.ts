import { useAppStore } from '../store/useStore.js';

const API_BASE_URL = 'http://localhost:5000/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = useAppStore.getState().token;
  const method = options.method || 'GET';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    let errMsg = 'Network request failed';
    try {
      const errJson = await response.json();
      errMsg = errJson.error || errJson.message || errMsg;
    } catch (e) {}
    
    // Auto logout if unauthorized (session expired)
    if (response.status === 401 || response.status === 403) {
      useAppStore.getState().clearAuth();
    }
    
    throw new Error(errMsg);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
export const api = {
  get: <T = any>(url: string, headers?: Record<string, string>) => apiRequest<T>(url, { method: 'GET', headers }),
  post: <T = any>(url: string, body: any, headers?: Record<string, string>) => apiRequest<T>(url, { method: 'POST', body, headers }),
  put: <T = any>(url: string, body: any, headers?: Record<string, string>) => apiRequest<T>(url, { method: 'PUT', body, headers }),
  patch: <T = any>(url: string, body: any, headers?: Record<string, string>) => apiRequest<T>(url, { method: 'PATCH', body, headers }),
  delete: <T = any>(url: string, headers?: Record<string, string>) => apiRequest<T>(url, { method: 'DELETE', headers }),
};
