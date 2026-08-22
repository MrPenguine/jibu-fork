import { Request } from 'express';

export function requestHeaders(request: Pick<Request, 'headers'>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  return headers;
}
