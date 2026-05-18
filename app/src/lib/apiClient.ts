import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

let apiClient: AxiosInstance | null = null;

/**
 * Interface for IPC results to match Axios response structure if needed
 */
interface IpcResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

/**
 * Check if we are running in Electron
 */
const isElectron = () => typeof window !== 'undefined' && !!window.electron;

/**
 * Route URL to IPC channel mapping
 */
const routeToIpc: Record<string, string> = {
  '/reports/': 'submit-report',
  '/mods/': 'get-warning-status', // specialized handling for :modId/warning
  '/mods/batch-warnings': 'get-batch-warnings',
  '/creators/': 'get-creator-ban-status',
};

/**
 * Helper to handle IPC requests
 */
function getConfigHeader(config: AxiosRequestConfig | undefined, name: string): string | undefined {
  const headers = config?.headers;
  if (!headers) return undefined;

  if (typeof (headers as any).get === 'function') {
    return (headers as any).get(name) ?? (headers as any).get(name.toLowerCase());
  }

  const matchingKey = Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase());
  const value = matchingKey ? (headers as Record<string, any>)[matchingKey] : undefined;
  return typeof value === 'string' ? value : undefined;
}

async function handleIpcRequest<T>(
  url: string,
  method: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> {
  if (!window.electron) throw new Error('Electron API not available');

  // Strip API prefix if present
  let cleanUrl = url.replace('/api/v1', '');
  
  // Extract query parameters if present
  let queryParams: Record<string, string> = {};
  if (cleanUrl.includes('?')) {
    const [pathPart, queryString] = cleanUrl.split('?');
    cleanUrl = pathPart;
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      queryParams[key] = value;
    });
  }

  let channel = '';
  let payload = data || queryParams;
  const apiKey = getConfigHeader(config, 'X-CurseForge-API-Key');

  if (cleanUrl.startsWith('/reports/')) {
    channel = 'submit-report';
    const modId = parseInt(cleanUrl.split('/')[2]);
    payload = { modId, report: data };
  } else if (cleanUrl.includes('/warning')) {
    channel = 'get-warning-status';
    const modId = parseInt(cleanUrl.split('/')[2]);
    payload = { modId }; // creatorId could be in data if we pass it
  } else if (cleanUrl === '/mods/batch-warnings') {
    channel = 'get-batch-warnings';
  } else if (cleanUrl.startsWith('/creators/') && cleanUrl.endsWith('/ban-status')) {
    channel = 'get-creator-ban-status';
    const creatorId = parseInt(cleanUrl.split('/')[2]);
    payload = { creatorId };
  } else if (cleanUrl.startsWith('/tools/') && cleanUrl.endsWith('/metadata')) {
    channel = 'tools:get-metadata';
    const toolId = cleanUrl.split('/')[2];
    payload = { toolId };
  } else if (cleanUrl === '/curseforge/search') {
    channel = 'curseforge-search';
    // Merge body data and query params for search
    payload = { ...queryParams, ...data, apiKey };
  } else if (cleanUrl === '/curseforge/categories') {
    channel = 'curseforge-get-categories';
    payload = { apiKey: data?.apiKey || queryParams.apiKey || apiKey };
  } else if (cleanUrl === '/curseforge/download-url') {
    channel = 'curseforge-download-url';
    payload = { ...data, apiKey: data?.apiKey || apiKey };
  } else if (cleanUrl.startsWith('/curseforge/batch-versions')) {
    channel = 'curseforge-batch-versions';
    payload = { ...data, apiKey: data?.apiKey || apiKey };
  } else if (cleanUrl.startsWith('/curseforge/')) {
    channel = 'curseforge-get-mod';
    const modId = parseInt(cleanUrl.split('/')[2]);
    payload = { modId, apiKey: data?.apiKey || queryParams.apiKey || apiKey };
  }

  if (!channel) {
    throw new Error(`No IPC channel mapped for ${method} ${url}`);
  }

  const result = await window.electron.ipcRenderer.invoke(channel, payload);
  
  // The services return the data directly or a result object
  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error || 'IPC Request Failed');
  }

  if (result && typeof result === 'object' && 'success' in result) {
    return result;
  }

  return { success: true, data: result } as T;
}

/**
 * Create or get the API client instance
 */
export async function getApiClient(token?: string): Promise<AxiosInstance> {
  if (!apiClient) {
    apiClient = axios.create({
      baseURL: BACKEND_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add interceptor to include access token
    apiClient.interceptors.request.use(
      (config) => {
        // Try to get token from parameter or localStorage
        const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add interceptor to handle 401 errors with automatic token refresh
    apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token
            const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('auth_refresh_token') : null;

            if (!refreshToken) {
              // No refresh token, redirect to login
              window.location.href = '/auth/login';
              return Promise.reject(error);
            }

            // Import here to avoid circular dependency
            const { refreshAccessToken } = await import('./curseforgeApi');
            const newAccessToken = await refreshAccessToken(refreshToken);

            // Update localStorage and cookies
            localStorage.setItem('auth_token', newAccessToken);
            const maxAge = 30 * 24 * 60 * 60;
            if (typeof document !== 'undefined') {
              document.cookie = `auth_token=${newAccessToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
            }

            // Update authorization header
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

            // Retry original request with new token
            if (!apiClient) {
              return Promise.reject(new Error('API client not initialized'));
            }
            return apiClient.request(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            window.location.href = '/auth/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  return apiClient;
}

/**
 * Make a GET request
 */
export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  if (isElectron() && !url.startsWith('http')) {
    return handleIpcRequest<T>(url, 'GET', undefined, config);
  }
  const client = await getApiClient();
  const response = await client.get<T>(url, config);
  return response.data;
}

/**
 * Make a POST request
 */
export async function apiPost<T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> {
  if (isElectron() && !url.startsWith('http')) {
    return handleIpcRequest<T>(url, 'POST', data, config);
  }
  const client = await getApiClient();
  const response = await client.post<T>(url, data, config);
  return response.data;
}

/**
 * Make a PATCH request
 */
export async function apiPatch<T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> {
  if (isElectron() && !url.startsWith('http')) {
    return handleIpcRequest<T>(url, 'PATCH', data, config);
  }
  const client = await getApiClient();
  const response = await client.patch<T>(url, data, config);
  return response.data;
}

/**
 * Make a DELETE request
 */
export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  if (isElectron() && !url.startsWith('http')) {
    return handleIpcRequest<T>(url, 'DELETE', undefined, config);
  }
  const client = await getApiClient();
  const response = await client.delete<T>(url, config);
  return response.data;
}
