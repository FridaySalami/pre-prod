<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { showToast } from '$lib/toastStore';
  import { userSession } from '$lib/sessionStore';
  
  // Form state - with proper types
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let loading = false;
  
  // User state - explicitly initialize with default values
  let isNewUser = false;
  let userEmail = '';
  let session: any = null;
  
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
  
  // Subscribe to auth state
  const unsubscribe = userSession.subscribe((s) => {
    session = s;
  });
  
  onMount(async () => {
    await checkUserStatus();
  });
  
  onDestroy(() => {
    unsubscribe();
  });
  
  // Check if user is a new user (no password set)
  async function checkUserStatus() {
    try {
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        showToast('Error retrieving user information', 'error');
        return;
      }
      
      if (data?.user) {
        userEmail = data.user.email || '';
        
        // Check if user has password auth enabled
        // For users coming from invite links, they typically don't have a password
        const hasPasswordAuth = data.user.identities?.some(identity => 
          identity.provider === 'email' && identity.identity_data?.password_hash
        );
        
        isNewUser = !hasPasswordAuth;
      }
    } catch (err) {
      console.error('Error checking user status:', err);
    }
  }
  
  // Update requirements as user types password
  function setRequirementMet(id: string, isMet: boolean): void {
    const requirement = requirements.find(r => r.id === id);
    if (requirement) {
      requirement.met = isMet;
    }
  }
  
  // Calculate password strength and update requirements
  $: {
    if (newPassword) {
      // Reset requirements
      requirements.forEach(req => req.met = false);
      
      setRequirementMet('length', newPassword.length >= 8);
      setRequirementMet('uppercase', /[A-Z]/.test(newPassword));
      setRequirementMet('lowercase', /[a-z]/.test(newPassword));
      setRequirementMet('number', /[0-9]/.test(newPassword));
      setRequirementMet('special', /[^A-Za-z0-9]/.test(newPassword));
      
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
    } else {
      passwordStrength = 0;
      strengthText = '';
      strengthClass = '';
    }
  }
  
  // Simple computed value for form validation - avoids the TypeScript error
  $: hasFormErrors = Object.values(passwordErrors).some(error => error !== '');
  
  // Computed value for button disabled state - typed as boolean
  $: isButtonDisabled = loading || 
                      hasFormErrors || 
                      (!isNewUser && !currentPassword) || 
                      !newPassword || 
                      !confirmPassword;
  
  // Validate form inputs
  function validateForm(): boolean {
    // Reset errors
    passwordErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    
    // Only validate current password for existing users
    if (!isNewUser && !currentPassword) {
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
    
    // Return true if no errors
    return !Object.values(passwordErrors).some(error => error !== '');
  }
  
  // Handle form submission
  async function handleSubmit() {
    if (!validateForm()) return;
    
    loading = true;
    
    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        showToast(`Failed to update password: ${error.message}`, 'error');
        loading = false;
        return;
      }
      
      // Success!
      if (isNewUser) {
        showToast('Password set successfully! You can now log in with your email and password.', 'success');
        
        // Redirect after successful password set for new users
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        showToast('Password updated successfully!', 'success');
      }
      
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
    <h1>{isNewUser ? 'Set Your Password' : 'Change Password'}</h1>
    <p class="description">
      {#if isNewUser}
        Welcome! Please set up your password to secure your account.
      {:else}
        Update your account password to keep your account secure.
      {/if}
    </p>
    
    <form on:submit|preventDefault={handleSubmit}>
      {#if !isNewUser}
        <!-- Only show current password field for existing users -->
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
      {/if}
      
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
          disabled={isButtonDisabled}
        >
          {#if loading}
            {isNewUser ? 'Setting...' : 'Updating...'}
          {:else}
            {isNewUser ? 'Set Password' : 'Update Password'}
          {/if}
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

  /* Add to your existing styles */
  .success-notification {
    background-color: #D1FAE5;
    border: 1px solid #10B981;
    color: #065F46;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 20px;
  }

  .redirect-message {
    font-size: 0.8rem;
    color: #6B7280;
    margin-top: 8px;
  }
</style>