import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock for getting folders
  http.get('*/api/v1/folders', () => {
    return HttpResponse.json([
      { id: 'folder_1', name: 'Default Projects' },
      { id: 'folder_2', name: 'Client A' },
    ]);
  }),

  // Mock for getting organization members
  http.get('*/api/v1/organizations/:orgId/members', () => {
    return HttpResponse.json([
      { id: 'user_1', name: 'Jibu AI', email: 'jibu@example.com', role: 'OWNER' },
      { id: 'user_2', name: 'Jane Doe', email: 'jane@example.com', role: 'ADMIN' },
    ]);
  }),
];
