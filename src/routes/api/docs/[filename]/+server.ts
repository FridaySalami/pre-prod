import { json } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { filename } = params;

  // Security check - only allow specific documentation files
  const allowedFiles = [
    'landing-page-documentation.md',
    'landing-page-dependencies.md',
    'schedule-page-documentation.md',
    'schedule-user-guide.md'
  ];

  if (!allowedFiles.includes(filename)) {
    return new Response('File not found', { status: 404 });
  }

  try {
    const filePath = join(process.cwd(), 'docs', filename);
    const content = await readFile(filePath, 'utf-8');

    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error reading documentation file:', error);
    return new Response('File not found', { status: 404 });
  }
};
