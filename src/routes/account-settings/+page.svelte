<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { showToast } from '$lib/toastStore';
  
  // Profile data with default placeholders
  let userData = {
    email: '',
    firstName: '',
    lastName: '',
    jobTitle: '',
    department: '',
    notificationPreferences: {
      emailNotifications: true,
      weeklyReports: true,
      systemUpdates: true
    },
    interfaceSettings: {
      compactView: false,
      darkMode: false,
      showHelpTips: true
    }
  };
  
  // Departments list for dropdown
  const departments = [
    { id: 'operations', name: 'Operations' },
    { id: 'finance', name: 'Finance' },
    { id: 'hr', name: 'Human Resources' },
    { id: 'it', name: 'IT' },
    { id: 'logistics', name: 'Logistics' },
    { id: 'management', name: 'Management' },
    { id: 'warehouse', name: 'Warehouse' }
  ];
  
  // State variables
  let loading = true;
  let saving = false;
  let activeTab = 'profile';
  
  // Form states
  let profileFormChanged = false;
  let notificationsFormChanged = false;
  let interfaceFormChanged = false;
  
  // Cache original values to detect changes
  let originalUserData: typeof userData;
  
  onMount(async () => {
    try {
      // Load current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Populate email from auth
        userData.email = session.user.email || '';
        
        // In the future, this would fetch profile data from profiles table
        // For now we'll just simulate data loading
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Placeholder profile data
        userData = {
          ...userData,
          firstName: 'John',
          lastName: 'Doe',
          jobTitle: 'Operations Manager',
          department: 'operations'
        };
        
        // Cache for change detection
        originalUserData = JSON.parse(JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      showToast('Failed to load account settings', 'error');
    } finally {
      loading = false;
    }
  });
  
  // Check if profile form has changed
  $: profileFormChanged = 
    userData.firstName !== originalUserData?.firstName ||
    userData.lastName !== originalUserData?.lastName ||
    userData.jobTitle !== originalUserData?.jobTitle ||
    userData.department !== originalUserData?.department;
  
  // Check if notifications form has changed
  $: notificationsFormChanged = 
    userData.notificationPreferences.emailNotifications !== originalUserData?.notificationPreferences.emailNotifications ||
    userData.notificationPreferences.weeklyReports !== originalUserData?.notificationPreferences.weeklyReports ||
    userData.notificationPreferences.systemUpdates !== originalUserData?.notificationPreferences.systemUpdates;
  
  // Check if interface form has changed
  $: interfaceFormChanged = 
    userData.interfaceSettings.compactView !== originalUserData?.interfaceSettings.compactView ||
    userData.interfaceSettings.darkMode !== originalUserData?.interfaceSettings.darkMode ||
    userData.interfaceSettings.showHelpTips !== originalUserData?.interfaceSettings.showHelpTips;
  
  // Save profile information
  async function saveProfile() {
    saving = true;
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Here you would update the profile in Supabase
      // const { error } = await supabase
      //   .from('profiles')
      //   .upsert({
      //     user_id: session.user.id,
      //     first_name: userData.firstName,
      //     last_name: userData.lastName,
      //     job_title: userData.jobTitle,
      //     department: userData.department,
      //   });
      
      // if (error) throw error;
      
      // Update cached values after successful save
      originalUserData = JSON.parse(JSON.stringify(userData));
      showToast('Profile information updated', 'success');
    } catch (error) {
      console.error('Error saving profile:', error);
      showToast('Failed to update profile', 'error');
    } finally {
      saving = false;
    }
  }
  
  // Save notification preferences
  async function saveNotificationPreferences() {
    saving = true;
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Here you would update preferences in Supabase
      // const { error } = await supabase
      //   .from('user_preferences')
      //   .upsert({
      //     user_id: session.user.id,
      //     email_notifications: userData.notificationPreferences.emailNotifications,
      //     weekly_reports: userData.notificationPreferences.weeklyReports,
      //     system_updates: userData.notificationPreferences.systemUpdates
      //   });
      
      // if (error) throw error;
      
      originalUserData.notificationPreferences = { ...userData.notificationPreferences };
      showToast('Notification preferences updated', 'success');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showToast('Failed to update notification preferences', 'error');
    } finally {
      saving = false;
    }
  }
  
  // Save interface settings
  async function saveInterfaceSettings() {
    saving = true;
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Here you would update interface settings in Supabase
      // const { error } = await supabase
      //   .from('user_preferences')
      //   .upsert({
      //     user_id: session.user.id,
      //     compact_view: userData.interfaceSettings.compactView,
      //     dark_mode: userData.interfaceSettings.darkMode,
      //     show_help_tips: userData.interfaceSettings.showHelpTips
      //   });
      
      // if (error) throw error;
      
      originalUserData.interfaceSettings = { ...userData.interfaceSettings };
      showToast('Interface settings updated', 'success');
    } catch (error) {
      console.error('Error saving interface settings:', error);
      showToast('Failed to update interface settings', 'error');
    } finally {
      saving = false;
    }
  }
</script>

<div class="account-settings-page">
  <div class="account-settings-container">
    <header class="page-header">
      <h1>Account Settings</h1>
      <p class="description">Manage your account information, preferences, and settings.</p>
    </header>
    
    <div class="settings-content">
      <!-- Settings tabs navigation -->
      <div class="settings-tabs">
        <button 
          class="tab-button {activeTab === 'profile' ? 'active' : ''}" 
          on:click={() => activeTab = 'profile'}
        >
          <i class="material-icons-outlined">person</i>
          Profile Information
        </button>
        <button 
          class="tab-button {activeTab === 'notifications' ? 'active' : ''}" 
          on:click={() => activeTab = 'notifications'}
        >
          <i class="material-icons-outlined">notifications</i>
          Notification Preferences
        </button>
        <button 
          class="tab-button {activeTab === 'interface' ? 'active' : ''}" 
          on:click={() => activeTab = 'interface'}
        >
          <i class="material-icons-outlined">settings</i>
          Interface Settings
        </button>
        <a href="/change-password" class="tab-button">
          <i class="material-icons-outlined">lock</i>
          Change Password
        </a>
      </div>
      
      <div class="settings-panel">
        {#if loading}
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading your settings...</p>
          </div>
        {:else}
          <!-- Profile Information Tab -->
          {#if activeTab === 'profile'}
            <div class="settings-section">
              <h2>Profile Information</h2>
              <p class="section-description">Update your personal information and job details.</p>
              
              <form on:submit|preventDefault={saveProfile}>
                <div class="form-row">
                  <div class="form-group">
                    <label for="firstName">First Name</label>
                    <input 
                      type="text" 
                      id="firstName" 
                      bind:value={userData.firstName} 
                      placeholder="Enter first name"
                    />
                  </div>
                  
                  <div class="form-group">
                    <label for="lastName">Last Name</label>
                    <input 
                      type="text" 
                      id="lastName" 
                      bind:value={userData.lastName} 
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="email">Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    value={userData.email} 
                    disabled 
                    class="disabled-input"
                  />
                  <small class="helper-text">Email address cannot be changed here. Please contact support.</small>
                </div>
                
                <div class="form-group">
                  <label for="jobTitle">Job Title</label>
                  <input 
                    type="text" 
                    id="jobTitle" 
                    bind:value={userData.jobTitle} 
                    placeholder="Enter your job title"
                  />
                </div>
                
                <div class="form-group">
                  <label for="department">Department</label>
                  <select id="department" bind:value={userData.department}>
                    <option value="">Select department</option>
                    {#each departments as dept}
                      <option value={dept.id}>{dept.name}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="form-actions">
                  <button 
                    type="submit" 
                    class="save-button" 
                    disabled={saving || !profileFormChanged}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          {/if}
          
          <!-- Notification Preferences Tab -->
          {#if activeTab === 'notifications'}
            <div class="settings-section">
              <h2>Notification Preferences</h2>
              <p class="section-description">Configure how and when you receive notifications.</p>
              
              <form on:submit|preventDefault={saveNotificationPreferences}>
                <div class="form-group checkbox-group">
                  <label class="checkbox-label">
                    <input 
                      type="checkbox" 
                      bind:checked={userData.notificationPreferences.emailNotifications} 
                    />
                    <span>Email Notifications</span>
                  </label>
                  <small class="helper-text">Receive notifications via email about important updates.</small>
                </div>
                
                <div class="form-group checkbox-group">
                  <label class="checkbox-label">
                    <input 
                      type="checkbox" 
                      bind:checked={userData.notificationPreferences.weeklyReports} 
                    />
                    <span>Weekly Report Summary</span>
                  </label>
                  <small class="helper-text">Receive a weekly email summarizing your dashboard metrics.</small>
                </div>
                
                <div class="form-group checkbox-group">
                  <label class="checkbox-label">
                    <input 
                      type="checkbox" 
                      bind:checked={userData.notificationPreferences.systemUpdates} 
                    />
                    <span>System Updates</span>
                  </label>
                  <small class="helper-text">Get notified about system updates and new features.</small>
                </div>
                
                <div class="form-actions">
                  <button 
                    type="submit" 
                    class="save-button" 
                    disabled={saving || !notificationsFormChanged}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          {/if}
          
          <!-- Interface Settings Tab -->
          {#if activeTab === 'interface'}
            <div class="settings-section">
              <h2>Interface Settings</h2>
              <p class="section-description">Customize your dashboard experience.</p>
              
              <form on:submit|preventDefault={saveInterfaceSettings}>
                <div class="form-group checkbox-group">
                  <label class="checkbox-label">
                    <input 
                      type="checkbox" 
                      bind:checked={userData.interfaceSettings.compactView} 
                    />
                    <span>Compact View</span>
                  </label>
                  <small class="helper-text">Use a more compact layout to fit more content on screen.</small>
                </div>
                
                <div class="form-group checkbox-group">
                  <label class="checkbox-label">
                    <input 
                      type="checkbox" 
                      bind:checked={userData.interfaceSettings.darkMode}
                      disabled 
                    />
                    <span>Dark Mode</span>
                    <span class="coming-soon-badge">Coming Soon</span>
                  </label>
                  <small class="helper-text">Switch to a dark color scheme (easier on the eyes at night).</small>
                </div>
                
                <div class="form-group checkbox-group">
                  <label class="checkbox-label">
                    <input 
                      type="checkbox" 
                      bind:checked={userData.interfaceSettings.showHelpTips} 
                    />
                    <span>Show Help Tips</span>
                  </label>
                  <small class="helper-text">Display tooltips and guidance for features.</small>
                </div>
                
                <div class="form-actions">
                  <button 
                    type="submit" 
                    class="save-button" 
                    disabled={saving || !interfaceFormChanged}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .account-settings-page {
    max-width: 1000px;
    margin: 32px auto;
    padding: 0 16px;
  }
  
  .account-settings-container {
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
    border: 1px solid #E5E7EB;
    overflow: hidden;
  }
  
  .page-header {
    padding: 24px 32px;
    border-bottom: 1px solid #E5E7EB;
  }
  
  .page-header h1 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    color: #1F2937;
  }
  
  .description {
    color: #6B7280;
    margin: 0;
  }
  
  .settings-content {
    display: flex;
    min-height: 500px;
  }
  
  .settings-tabs {
    width: 240px;
    background-color: #F9FAFB;
    border-right: 1px solid #E5E7EB;
    padding: 16px 0;
  }
  
  .tab-button {
    display: flex;
    align-items: center;
    padding: 12px 24px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: #4B5563;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    text-decoration: none;
  }
  
  .tab-button i {
    margin-right: 12px;
    font-size: 20px;
  }
  
  .tab-button:hover {
    background-color: #F3F4F6;
    color: #1F2937;
  }
  
  .tab-button.active {
    background-color: #FFFFFF;
    color: #004225;
    font-weight: 500;
    box-shadow: inset 3px 0 0 #004225;
  }
  
  .settings-panel {
    flex: 1;
    padding: 24px 32px;
  }
  
  .settings-section h2 {
    margin: 0 0 8px 0;
    font-size: 1.2rem;
    color: #1F2937;
  }
  
  .section-description {
    color: #6B7280;
    margin-top: 0;
    margin-bottom: 24px;
  }
  
  .form-row {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }
  
  .form-row .form-group {
    flex: 1;
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
  
  input[type="text"],
  input[type="email"],
  select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    font-size: 0.95rem;
    transition: border-color 0.15s ease;
  }
  
  input:focus,
  select:focus {
    outline: none;
    border-color: #3B82F6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .disabled-input {
    background-color: #F9FAFB;
    color: #6B7280;
    cursor: not-allowed;
  }
  
  .helper-text {
    display: block;
    margin-top: 6px;
    color: #6B7280;
    font-size: 0.8rem;
  }
  
  .checkbox-group {
    margin-bottom: 16px;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    font-weight: 400;
    gap: 8px;
    cursor: pointer;
  }
  
  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }
  
  .checkbox-label input[type="checkbox"]:disabled {
    cursor: not-allowed;
  }
  
  .coming-soon-badge {
    background-color: #F3F4F6;
    color: #6B7280;
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 8px;
  }
  
  .form-actions {
    margin-top: 32px;
    display: flex;
    justify-content: flex-end;
  }
  
  .save-button {
    padding: 10px 16px;
    background-color: #004225;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .save-button:hover:not(:disabled) {
    background-color: #003018;
  }
  
  .save-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: #6B7280;
  }
  
  .loading-spinner {
    border: 3px solid rgba(0, 66, 37, 0.1);
    border-top: 3px solid #004225;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @media (max-width: 768px) {
    .settings-content {
      flex-direction: column;
    }
    
    .settings-tabs {
      width: 100%;
      display: flex;
      overflow-x: auto;
      border-right: none;
      border-bottom: 1px solid #E5E7EB;
      padding: 0;
    }
    
    .tab-button {
      padding: 12px 16px;
      white-space: nowrap;
    }
    
    .tab-button.active {
      box-shadow: inset 0 -3px 0 #004225;
    }
    
    .form-row {
      flex-direction: column;
      gap: 0;
    }
  }
</style>