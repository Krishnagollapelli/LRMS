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

export function getClientType(): 'Electron' | 'Web' {
  if (typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('electron')) {
    return 'Electron';
  }
  return 'Web';
}

export function getOrGenerateDeviceId(): string {
  if (typeof window === 'undefined') return 'SERVER-SIDE';
  let deviceId = localStorage.getItem('lrms_device_id');
  if (!deviceId) {
    if (typeof window.crypto !== 'undefined' && typeof window.crypto.randomUUID === 'function') {
      deviceId = window.crypto.randomUUID();
    } else {
      deviceId = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
    }
    localStorage.setItem('lrms_device_id', deviceId);
  }
  return deviceId;
}

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    
    if (protocol === 'https:') {
      return `https://${hostname}:5000/api`;
    }
    
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
    'X-Client-Type': getClientType(),
    'X-Device-ID': getOrGenerateDeviceId(),
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

  // Normalize slashes to prevent double slashes (e.g. url//endpoint)
  const cleanBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${cleanBase}${cleanEndpoint}`;

  const response = await fetch(url, config);

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
