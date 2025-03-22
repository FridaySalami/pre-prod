<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { User } from '@supabase/supabase-js';
  
  // Fix the type of user to be null | User
  let user: User | null = null;
  let loading = true;
  
  onMount(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        user = session.user;
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      loading = false;
    }
  });
</script>

<div class="profile-page">
  <div class="profile-card">
    <h1>My Profile</h1>
    
    {#if loading}
      <p>Loading profile information...</p>
    {:else if user}
      <div class="profile-info">
        <div class="profile-section">
          <h2>Account Information</h2>
          <div class="info-group">
            <!-- Fix accessibility - use span instead of label or associate with invisible inputs -->
            <span class="info-label">Email</span>
            <div class="info-value">{user.email}</div>
          </div>
          <div class="info-group">
            <span class="info-label">Account ID</span>
            <div class="info-value">{user.id}</div>
          </div>
          <div class="info-group">
            <span class="info-label">Last Sign In</span>
            <div class="info-value">
              {#if user.last_sign_in_at}
                {new Date(user.last_sign_in_at).toLocaleString()}
              {:else}
                Not available
              {/if}
            </div>
          </div>
        </div>
        
        <div class="coming-soon-section">
          <h3>Coming Soon</h3>
          <p>Profile customization options will be available in a future update.</p>
          <ul>
            <li>Profile picture</li>
            <li>Display name</li>
            <li>Notification preferences</li>
            <li>Dashboard customization</li>
          </ul>
        </div>
      </div>
    {:else}
      <p class="error-message">Unable to load profile. Please try again later.</p>
    {/if}
  </div>
</div>

<style>
  .profile-page {
    max-width: 900px;
    margin: 32px auto;
    padding: 0 16px;
  }
  
  .profile-card {
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
    padding: 32px;
    border: 1px solid #E5E7EB;
  }
  
  h1 {
    color: #1F2937;
    font-size: 1.5rem;
    margin-top: 0;
    margin-bottom: 24px;
  }
  
  h2 {
    color: #1F2937;
    font-size: 1.2rem;
    margin-top: 0;
    margin-bottom: 16px;
    font-weight: 500;
  }
  
  h3 {
    color: #4B5563;
    font-size: 1rem;
    margin-top: 0;
    margin-bottom: 12px;
  }
  
  .profile-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
  
  .profile-section {
    margin-bottom: 24px;
  }
  
  .info-group {
    margin-bottom: 16px;
  }
  
  /* Change from label to info-label */
  .info-label {
    display: block;
    font-size: 0.8rem;
    color: #6B7280;
    margin-bottom: 4px;
  }
  
  .info-value {
    font-size: 1rem;
    color: #1F2937;
    padding: 8px 0;
  }
  
  .coming-soon-section {
    background-color: #F9FAFB;
    border-radius: 8px;
    padding: 16px;
    border: 1px solid #E5E7EB;
  }
  
  .coming-soon-section p {
    color: #6B7280;
    margin-bottom: 12px;
  }
  
  .coming-soon-section ul {
    padding-left: 20px;
    margin: 0;
    color: #6B7280;
  }
  
  .coming-soon-section li {
    margin-bottom: 4px;
  }
  
  .error-message {
    color: #DC2626;
  }
  
  @media (max-width: 768px) {
    .profile-info {
      grid-template-columns: 1fr;
    }
  }
</style>