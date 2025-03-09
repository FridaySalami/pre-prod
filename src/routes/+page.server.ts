// src/routes/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const load = () => {
  // Redirect to /dashboard when visiting the root.
  throw redirect(302, '/dashboard');
};