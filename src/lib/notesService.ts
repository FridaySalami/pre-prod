import { supabase } from './supabaseClient';
import type { NoteData } from './MetricsSidePanel.svelte';

// Interface for database note with IDs and timestamps
export interface DbNote {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  title: string;
  root_cause: string;
  details: string;
  action_plan: string;
  comments: string[];
  metric_id: string;
  day_id?: string;
}

// Convert from DB format to component format
export function dbToNoteData(dbNote: DbNote): NoteData {
  return {
    title: dbNote.title || '',
    rootCause: dbNote.root_cause || '',
    details: dbNote.details || '',
    actionPlan: dbNote.action_plan || '',
    comments: dbNote.comments || []
  };
}

// Convert from component format to DB format
export function noteDataToDb(note: NoteData, metricId: string, dayId?: string): Omit<DbNote, 'id' | 'created_at' | 'updated_at' | 'user_id'> {
  return {
    title: note.title || '',
    root_cause: note.rootCause || '',
    details: note.details || '',
    action_plan: note.actionPlan || '',
    comments: note.comments || [],
    metric_id: metricId,
    day_id: dayId
  };
}

// Check if metrics_notes table exists
export async function checkTableExists() {
  try {
    console.log("Checking if metrics_notes table exists...");
    
    // Try to query the table structure
    const { data, error } = await supabase
      .from('metrics_notes')
      .select('id')
      .limit(1);
    
    console.log("Table check result:", { data, error });
    
    if (error) {
      if (error.code === '42P01') { // PostgreSQL code for undefined_table
        console.error("Table metrics_notes does not exist!");
        return false;
      }
      console.error("Error checking table:", error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error("Exception checking table:", err);
    return false;
  }
}

// Save a new note
export async function saveNote(note: NoteData, metricId: string, dayId?: string) {
  console.log("saveNote called with:", { note, metricId, dayId });
  
  // Ensure we have a valid metric ID
  if (!metricId) {
    console.error("Missing metric ID for note save");
    throw new Error('Cannot save note: metric ID is required');
  }

  try {
    // Get user session directly from supabase
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    console.log("Current session:", session);
    
    if (sessionError) {
      console.error("Error getting session:", sessionError);
      throw sessionError;
    }
    
    // Get user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    console.log("Current user data:", userData);
    
    if (userError) {
      console.error("Error getting user:", userError);
      throw userError;
    }
    
    if (!userData?.user?.id) {
      console.error("No authenticated user found");
      // For testing, use a placeholder user ID
      const testUserId = '00000000-0000-0000-0000-000000000000';
      console.log("Using test user ID:", testUserId);
      
      const noteData = {
        title: note.title || '',
        root_cause: note.rootCause || '',
        details: note.details || '',
        action_plan: note.actionPlan || '',
        comments: note.comments || [],
        metric_id: metricId,
        day_id: dayId,
        user_id: testUserId
      };
      
      console.log("Prepared note data for insert:", noteData);
      
      const { data, error } = await supabase
        .from("metrics_notes")
        .insert([noteData])
        .select();
        
      console.log("Supabase insert response:", { data, error });
      
      if (error) {
        console.error('Error saving note:', error);
        throw error;
      }
      
      return data?.[0];
    } else {
      // Normal flow - authenticated user
      const noteData = {
        title: note.title || '',
        root_cause: note.rootCause || '',
        details: note.details || '',
        action_plan: note.actionPlan || '',
        comments: note.comments || [],
        metric_id: metricId,
        day_id: dayId,
        user_id: userData.user.id
      };
      
      console.log("Prepared note data for insert:", noteData);
      
      // Try a direct insert without using noteDataToDb
      const { data, error } = await supabase
        .from("metrics_notes")
        .insert([noteData])
        .select();
        
      console.log("Supabase insert response:", { data, error });
      
      if (error) {
        console.error('Error saving note:', error);
        if (error.code === '23502') { // not-null constraint violation
          console.error('Not-null constraint violation. Check if any required fields are missing.');
        } else if (error.code === '23503') { // foreign key violation
          console.error('Foreign key violation. Check if user_id exists in auth.users table.');
        }
        throw error;
      }
      
      return data?.[0];
    }
  } catch (err) {
    console.error("Exception in saveNote:", err);
    throw err;
  }
}

// Update an existing note
export async function updateNote(id: string, note: NoteData) {
  if (!id) {
    throw new Error('Cannot update note: note ID is required');
  }

  console.log("Updating note:", { id, note });

  try {
    const { data, error } = await supabase
      .from('metrics_notes')
      .update({
        title: note.title || '',
        root_cause: note.rootCause || '',
        details: note.details || '',
        action_plan: note.actionPlan || '',
        comments: note.comments || []
      })
      .eq('id', id)
      .select();
    
    console.log("Supabase update response:", { data, error });
    
    if (error) {
      console.error('Error updating note:', error);
      throw error;
    }
    
    return data?.[0];
  } catch (err) {
    console.error("Exception in updateNote:", err);
    throw err;
  }
}

// Get a note by metric ID
export async function getNoteByMetricId(metricId: string, dayId?: string) {
  if (!metricId) {
    throw new Error('Cannot get note: metric ID is required');
  }

  console.log("Getting note for metric:", { metricId, dayId });

  try {
    let query = supabase
      .from('metrics_notes')
      .select('*')
      .eq('metric_id', metricId);
      
    if (dayId) {
      query = query.eq('day_id', dayId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1);
    
    console.log("Supabase get response:", { data, error });
    
    if (error) {
      console.error('Error getting note:', error);
      throw error;
    }
    
    return data?.[0] ? data[0] : null;
  } catch (err) {
    console.error("Exception in getNoteByMetricId:", err);
    throw err;
  }
}

// Delete a note
export async function deleteNote(id: string) {
  if (!id) {
    throw new Error('Cannot delete note: note ID is required');
  }

  const { error } = await supabase
    .from('metrics_notes')
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
  
  return true;
}

// Add this to notesService.ts
export async function testDirectInsert() {
  try {
    const testNote = {
      title: "Test Note",
      root_cause: "Test Root Cause",
      details: "Test Details",
      action_plan: "Test Action Plan",
      comments: ["Test Comment"],
      metric_id: "test_metric",
      day_id: "2025-03-21",
      user_id: "00000000-0000-0000-0000-000000000000" // Use a test UUID
    };
    
    console.log("Testing direct insert with:", testNote);
    
    const { data, error } = await supabase
      .from("metrics_notes")
      .insert([testNote])
      .select();
      
    console.log("Direct insert result:", { data, error });
    
    return { success: !error, data, error };
  } catch (err) {
    console.error("Error in testDirectInsert:", err);
    return { success: false, error: err };
  }
}