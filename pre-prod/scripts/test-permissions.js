// Test the permission logic
function hasRequiredPermissions(userRole, requiredLevel) {
  // Define what roles are allowed for each access level
  const accessLevels = {
    'admin': ['admin'], // Only admin can access admin routes
    'manager': ['admin', 'manager'], // Admin and manager can access manager routes
    'user': ['admin', 'manager', 'user'] // All roles can access user routes
  };

  if (!userRole) return false;

  const allowedRoles = accessLevels[requiredLevel] || [];
  return allowedRoles.includes(userRole);
}

console.log('Testing permission logic:');
console.log('Admin user accessing admin route:', hasRequiredPermissions('admin', 'admin')); // Should be true
console.log('Admin user accessing manager route:', hasRequiredPermissions('admin', 'manager')); // Should be true
console.log('Manager user accessing admin route:', hasRequiredPermissions('manager', 'admin')); // Should be false
console.log('Manager user accessing manager route:', hasRequiredPermissions('manager', 'manager')); // Should be true

console.log('\nRoutes for jackweston@gmail.com (admin role):');
console.log('- /buy-box-monitor (manager): ', hasRequiredPermissions('admin', 'manager'));
console.log('- /buy-box-manager (admin): ', hasRequiredPermissions('admin', 'admin'));
