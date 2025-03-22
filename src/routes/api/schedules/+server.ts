import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

interface Schedule {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'pending';
}

// In-memory store for demo purposes
let schedules: Schedule[] = [
  {
    id: '1',
    title: 'Q1 Planning',
    startDate: '2025-01-01',
    endDate: '2025-03-31',
    status: 'completed'
  },
  {
    id: '2',
    title: 'Summer Campaign',
    startDate: '2025-06-01',
    endDate: '2025-08-31',
    status: 'active'
  },
  {
    id: '3',
    title: 'Holiday Promotion',
    startDate: '2025-11-01',
    endDate: '2025-12-31',
    status: 'pending'
  }
];

export const GET: RequestHandler = () => {
  return json({ status: 'ok' });
};

export const POST: RequestHandler = async ({ request }) => {
  const newSchedule = await request.json();
  
  // Generate an ID
  const id = Date.now().toString();
  
  // Add to our "database"
  const schedule = { ...newSchedule, id } as Schedule;
  schedules.push(schedule);
  
  return json(schedule, { status: 201 });
};