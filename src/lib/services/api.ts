// src/lib/api.ts - Authenticated API client
import { browser } from '$app/environment';

/**
 * Authenticated fetch wrapper that automatically includes credentials
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  return fetch(url, mergedOptions);
}

/**
 * Authenticated API GET request
 */
export async function apiGet(url: string): Promise<any> {
  const response = await authenticatedFetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Authenticated API POST request
 */
export async function apiPost(url: string, data?: any): Promise<any> {
  const response = await authenticatedFetch(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Authenticated API PUT request
 */
export async function apiPut(url: string, data?: any): Promise<any> {
  const response = await authenticatedFetch(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Authenticated API DELETE request
 */
export async function apiDelete(url: string): Promise<any> {
  const response = await authenticatedFetch(url, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}
