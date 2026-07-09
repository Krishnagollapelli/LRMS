import { useAppStore } from '../store/useStore.js';

export function getBrowserFingerprint(): string {
  if (typeof window === 'undefined') return 'SERVER-SIDE';

  const navigator = window.navigator;
  const screen = window.screen;
  
  const userAgent = navigator.userAgent || '';
  const language = navigator.language || '';
  const platform = navigator.platform || '';
  const screenSpec = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  
  let canvasHash = '';
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125,1,62,20);
      ctx.fillStyle = "#069";
      ctx.fillText("LRMS-Verify, 😃", 2, 15);
      
      const dataUrl = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        const char = dataUrl.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      canvasHash = Math.abs(hash).toString(16);
    }
  } catch (e) {
    canvasHash = 'no-canvas';
  }

  const rawString = `${userAgent}:${language}:${platform}:${screenSpec}:${timeZone}:${canvasHash}`;
  
  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const hexPart = Math.abs(hash).toString(16).padStart(8, '0');
  const cleanUA = userAgent.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16).toLowerCase();
  
  return `FP-${hexPart}-${cleanUA}`;
}

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getApiBaseUrl();

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
    'X-Device-Fingerprint': getBrowserFingerprint(),
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
