<!-- In /src/routes/set-password/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { showToast } from '$lib/toastStore';
  import { userSession } from '$lib/sessionStore';
  
  let newPassword = '';
  let confirmPassword = '';
  let loading = false;
  let session: any = null;
  let userEmail = '';
  let needsPasswordSetup = false;

  // Password validation state
  let passwordErrors = {
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

  // Function to check password strength
  function checkPasswordStrength(password: string): number {
    // Reset requirements
    requirements.forEach(req => req.met = false);
    
    // Since we know these requirements exist in our array, we can use "as" to assert the type
    (requirements.find(r => r.id === 'length') as typeof requirements[0]).met = password.length >= 8;
    (requirements.find(r => r.id === 'uppercase') as typeof requirements[0]).met = /[A-Z]/.test(password);
    (requirements.find(r => r.id === 'lowercase') as typeof requirements[0]).met = /[a-z]/.test(password);
    (requirements.find(r => r.id === 'number') as typeof requirements[0]).met = /[0-9]/.test(password);
    (requirements.find(r => r.id === 'special') as typeof requirements[0]).met = /[^A-Za-z0-9]/.test(password);
    
    // Calculate strength (0-5)
    return requirements.filter(r => r.met).length;
  }

  // Update strength indicators when password changes
  $: {
    if (newPassword) {
      passwordStrength = checkPasswordStrength(newPassword);
      
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

  // Compute whether there are form errors
  $: hasFormErrors = Object.values(passwordErrors).some(error => error !== '');

  // Compute whether the button should be disabled
  $: isButtonDisabled = loading || hasFormErrors || !newPassword || !confirmPassword;
  
  onMount(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    session = sessionData.session;
    
    if (!session) {
      // Redirect to login if no session
      goto('/login');
      return;
    }
    
    const { data, error } = await supabase.auth.getUser();
    
    if (error || !data?.user) {
      goto('/login');
      return;
    }
    
    userEmail = data.user.email || '';
    
    // Check if user needs password setup
    // For users coming from invite links or OAuth
    const authProvider = data.user.app_metadata?.provider;
    needsPasswordSetup = !authProvider || authProvider !== 'email';
    
    // If user already has password set up, redirect them
    if (!needsPasswordSetup) {
      goto('/dashboard');
    }
  });
  
  async function handleSetPassword() {
    if (!validateForm()) return;
    
    loading = true;
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        showToast(`Failed to set password: ${error.message}`, 'error');
        return;
      }
      
      // Mark password as set in localStorage
      localStorage.setItem('password_set', 'true');
      
      showToast('Password set successfully! Your account setup is complete.', 'success');
      
      // Redirect to dashboard after success
      setTimeout(() => {
        goto('/dashboard');
      }, 1500);
    } catch (err) {
      console.error('Error setting password:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      loading = false;
    }
  }
  
  // Simplified validation function that returns a boolean
  function validateForm(): boolean {
    // Reset errors
    passwordErrors = {
      newPassword: '',
      confirmPassword: ''
    };
    
    // Validate new password
    if (!newPassword) {
      passwordErrors.newPassword = 'Password is required';
    } else if (newPassword.length < 8) {
      passwordErrors.newPassword = 'Password must be at least 8 characters';
    } else if (passwordStrength < 3) {
      passwordErrors.newPassword = 'Password is too weak';
    }
    
    // Validate confirm password
    if (!confirmPassword) {
      passwordErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      passwordErrors.confirmPassword = 'Passwords do not match';
    }
    
    // Return true if there are no errors
    return !Object.values(passwordErrors).some(error => error !== '');
  }
</script>

<!-- Simplified template without current password field -->
<div class="setup-page">
  <div class="setup-card">
    <h1>Complete Your Account Setup</h1>
    <p class="description">
      Set a secure password to protect your account.
    </p>
    
    <form on:submit|preventDefault={handleSetPassword}>
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
        <label for="confirmPassword">Confirm Password</label>
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
        <button 
          type="submit" 
          class="setup-button" 
          disabled={isButtonDisabled}
        >
          {loading ? 'Setting Password...' : 'Set Password'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* You can reuse most of the styles from your change-password component */
  .setup-page {
    max-width: 500px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  
  .setup-card {
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    padding: 24px;
  }
  
  h1 {
    color: #1E293B;
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 1.5rem;
    font-weight: 600;
  }
  
  .description {
    color: #64748B;
    margin-bottom: 24px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #334155;
  }
  
  .password-input-container {
    position: relative;
  }
  
  input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #CBD5E1;
    border-radius: 6px;
    font-size: 16px;
  }
  
  input.error {
    border-color: #EF4444;
  }
  
  .error-message {
    color: #EF4444;
    font-size: 0.85rem;
    margin-top: 4px;
    margin-bottom: 0;
  }
  
  .password-strength {
    margin-top: 8px;
  }
  
  .strength-meter {
    height: 6px;
    background-color: #E2E8F0;
    border-radius: 3px;
    overflow: hidden;
  }
  
  .strength-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  
  .strength-bar.very-weak { background-color: #EF4444; }
  .strength-bar.weak { background-color: #F97316; }
  .strength-bar.medium { background-color: #FACC15; }
  .strength-bar.strong { background-color: #10B981; }
  .strength-bar.very-strong { background-color: #059669; }
  
  .strength-text {
    display: block;
    margin-top: 4px;
    font-size: 0.85rem;
  }
  
  .strength-text.very-weak { color: #EF4444; }
  .strength-text.weak { color: #F97316; }
  .strength-text.medium { color: #CA8A04; }
  .strength-text.strong { color: #10B981; }
  .strength-text.very-strong { color: #059669; }
  
  .password-requirements {
    margin-top: 16px;
    background-color: #F8FAFC;
    border-radius: 6px;
    padding: 12px;
  }
  
  .requirements-title {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
  }
  
  .password-requirements ul {
    margin: 0;
    padding: 0 0 0 20px;
    list-style-type: none;
  }
  
  .password-requirements li {
    margin-bottom: 4px;
    font-size: 0.875rem;
    color: #64748B;
    position: relative;
    padding-left: 20px;
  }
  
  .password-requirements li:before {
    content: '✕';
    color: #94A3B8;
    position: absolute;
    left: 0;
  }
  
  .password-requirements li.met {
    color: #047857;
  }
  
  .password-requirements li.met:before {
    content: '✓';
    color: #10B981;
  }
  
  .actions {
    margin-top: 24px;
  }
  
  .setup-button {
    width: 100%;
    padding: 12px 16px;
    background-color: #004225;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .setup-button:hover:not(:disabled) {
    background-color: #003018;
  }
  
  .setup-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>