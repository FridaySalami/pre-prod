<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { showToast } from '$lib/toastStore';
  
  // Form state
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let loading = false;
  
  // Validation state
  let passwordErrors = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  
  // Password strength indicators
  let passwordStrength = 0;
  let strengthText = '';
  let strengthClass = '';
  
  // Password validation requirements
  const requirements = [
    { id: 'length', label: 'At least 8 characters', met: false },
    { id: 'uppercase', label: 'At least 1 uppercase letter', met: false },
    { id: 'lowercase', label: 'At least 1 lowercase letter', met: false },
    { id: 'number', label: 'At least 1 number', met: false },
    { id: 'special', label: 'At least 1 special character', met: false }
  ];
  
  // Check if any field has an error
  $: hasErrors = Object.values(passwordErrors).some(error => error !== '');
  
  // Check password strength in real-time
  $: {
    // Reset requirements
    requirements.forEach(req => req.met = false);
    
    // Check if requirements are met
    if (newPassword.length >= 8) requirements.find(r => r.id === 'length').met = true;
    if (/[A-Z]/.test(newPassword)) requirements.find(r => r.id === 'uppercase').met = true;
    if (/[a-z]/.test(newPassword)) requirements.find(r => r.id === 'lowercase').met = true;
    if (/[0-9]/.test(newPassword)) requirements.find(r => r.id === 'number').met = true;
    if (/[^A-Za-z0-9]/.test(newPassword)) requirements.find(r => r.id === 'special').met = true;
    
    // Calculate strength based on requirements met
    passwordStrength = requirements.filter(r => r.met).length;
    
    // Set strength text and class
    if (passwordStrength === 0) {
      strengthText = 'Very Weak';
      strengthClass = 'very-weak';
    } else if (passwordStrength <= 2) {
      strengthText = 'Weak';
      strengthClass = 'weak';
    } else if (passwordStrength <= 3) {
      strengthText = 'Medium';
      strengthClass = 'medium';
    } else if (passwordStrength === 4) {
      strengthText = 'Strong';
      strengthClass = 'strong';
    } else {
      strengthText = 'Very Strong';
      strengthClass = 'very-strong';
    }
  }
  
  // Validate the form
  function validateForm() {
    // Reset errors
    passwordErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    
    // Validate current password
    if (!currentPassword) {
      passwordErrors.currentPassword = 'Current password is required';
    }
    
    // Validate new password
    if (!newPassword) {
      passwordErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      passwordErrors.newPassword = 'Password must be at least 8 characters';
    } else if (passwordStrength < 3) {
      passwordErrors.newPassword = 'Password is too weak';
    }
    
    // Validate confirm password
    if (!confirmPassword) {
      passwordErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      passwordErrors.confirmPassword = 'Passwords do not match';
    }
    
    return !hasErrors;
  }
  
  // Handle form submission
  async function handleSubmit() {
    if (!validateForm()) return;
    
    loading = true;
    
    try {
      // Step 1: Get the current user's session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        showToast('Error accessing your account. Please try logging in again.', 'error');
        console.error('Session error:', sessionError);
        loading = false;
        return;
      }
      
      if (!session || !session.user) {
        showToast('You must be logged in to change your password', 'error');
        loading = false;
        return;
      }
      
      // Step 2: Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) {
        showToast(`Failed to update password: ${updateError.message}`, 'error');
        console.error('Update error:', updateError);
        loading = false;
        return;
      }
      
      // Success
      showToast('Password updated successfully!', 'success');
      
      // Reset form
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      
    } catch (err) {
      console.error('Unexpected error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="password-page">
  <div class="password-card">
    <h1>Change Password</h1>
    <p class="description">Update your account password to keep your account secure.</p>
    
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="currentPassword">Current Password</label>
        <div class="password-input-container">
          <input 
            type="password" 
            id="currentPassword" 
            bind:value={currentPassword}
            class:error={passwordErrors.currentPassword} 
            autocomplete="current-password"
          />
        </div>
        {#if passwordErrors.currentPassword}
          <p class="error-message">{passwordErrors.currentPassword}</p>
        {/if}
      </div>
      
      <div class="form-group">
        <label for="newPassword">New Password</label>
        <div class="password-input-container">
          <input 
            type="password" 
            id="newPassword" 
            bind:value={newPassword}
            class:error={passwordErrors.newPassword} 
            autocomplete="new-password"
          />
        </div>
        {#if passwordErrors.newPassword}
          <p class="error-message">{passwordErrors.newPassword}</p>
        {:else if newPassword}
          <div class="password-strength">
            <div class="strength-meter">
              <div class="strength-bar {strengthClass}" style="width: {(passwordStrength / 5) * 100}%"></div>
            </div>
            <span class="strength-text {strengthClass}">{strengthText}</span>
          </div>
        {/if}
        
        <!-- Password requirements -->
        <div class="password-requirements">
          <p class="requirements-title">Password must include:</p>
          <ul>
            {#each requirements as requirement}
              <li class:met={requirement.met}>{requirement.label}</li>
            {/each}
          </ul>
        </div>
      </div>
      
      <div class="form-group">
        <label for="confirmPassword">Confirm New Password</label>
        <div class="password-input-container">
          <input 
            type="password" 
            id="confirmPassword" 
            bind:value={confirmPassword}
            class:error={passwordErrors.confirmPassword} 
            autocomplete="new-password"
          />
        </div>
        {#if passwordErrors.confirmPassword}
          <p class="error-message">{passwordErrors.confirmPassword}</p>
        {/if}
      </div>
      
      <div class="actions">
        <button type="button" class="cancel-button" on:click={() => history.back()}>Cancel</button>
        <button 
          type="submit" 
          class="change-button" 
          disabled={loading || hasErrors || !currentPassword || !newPassword || !confirmPassword}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .password-page {
    max-width: 600px;
    margin: 32px auto;
    padding: 0 16px;
  }
  
  .password-card {
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
    margin-bottom: 8px;
  }
  
  .description {
    color: #6B7280;
    margin-bottom: 24px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }
  
  .password-input-container {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    font-size: 0.95rem;
    transition: border-color 0.15s ease;
  }
  
  input:focus {
    outline: none;
    border-color: #3B82F6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  input.error {
    border-color: #EF4444;
  }
  
  .error-message {
    color: #EF4444;
    font-size: 0.8rem;
    margin-top: 6px;
    margin-bottom: 0;
  }
  
  .password-strength {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .strength-meter {
    flex-grow: 1;
    height: 4px;
    background-color: #E5E7EB;
    border-radius: 2px;
    overflow: hidden;
  }
  
  .strength-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  
  .strength-bar.very-weak { background-color: #EF4444; }
  .strength-bar.weak { background-color: #F59E0B; }
  .strength-bar.medium { background-color: #FBBF24; }
  .strength-bar.strong { background-color: #10B981; }
  .strength-bar.very-strong { background-color: #10B981; }
  
  .strength-text {
    font-size: 0.8rem;
    font-weight: 500;
  }
  
  .strength-text.very-weak { color: #EF4444; }
  .strength-text.weak { color: #F59E0B; }
  .strength-text.medium { color: #FBBF24; }
  .strength-text.strong { color: #10B981; }
  .strength-text.very-strong { color: #10B981; }
  
  .password-requirements {
    margin-top: 12px;
    background-color: #F9FAFB;
    border-radius: 6px;
    padding: 12px;
    border: 1px solid #E5E7EB;
  }
  
  .requirements-title {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 0.8rem;
    color: #4B5563;
    font-weight: 500;
  }
  
  .password-requirements ul {
    margin: 0;
    padding-left: 20px;
    font-size: 0.8rem;
    color: #6B7280;
  }
  
  .password-requirements li {
    margin-bottom: 4px;
    transition: color 0.2s ease;
  }
  
  .password-requirements li.met {
    color: #10B981;
  }
  
  .password-requirements li.met::marker {
    color: #10B981;
  }
  
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 32px;
  }
  
  .cancel-button {
    padding: 10px 16px;
    background-color: white;
    color: #4B5563;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .cancel-button:hover {
    background-color: #F9FAFB;
  }
  
  .change-button {
    padding: 10px 16px;
    background-color: #004225;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .change-button:hover:not(:disabled) {
    background-color: #003018;
  }
  
  .change-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>