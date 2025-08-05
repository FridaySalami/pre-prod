/**
 * Amazon Credentials Validator
 * Validates that required Amazon API credentials are properly configured
 */

export interface CredentialValidationResult {
  isValid: boolean;
  missingCredentials: string[];
  warnings: string[];
  hasAllRequired: boolean;
}

/**
 * Validate Amazon API credentials
 */
export function validateAmazonCredentials(): CredentialValidationResult {
  const requiredCredentials = [
    'AMAZON_CLIENT_ID',
    'AMAZON_CLIENT_SECRET',
    'AMAZON_REFRESH_TOKEN'
  ];

  const optionalCredentials = [
    'AMAZON_AWS_ACCESS_KEY_ID',
    'AMAZON_AWS_SECRET_ACCESS_KEY'
  ];

  const missingCredentials: string[] = [];
  const warnings: string[] = [];

  // Check required credentials
  requiredCredentials.forEach(credentialName => {
    const value = process.env[credentialName];
    if (!value || value.trim() === '') {
      missingCredentials.push(credentialName);
    }
  });

  // Check optional credentials
  optionalCredentials.forEach(credentialName => {
    const value = process.env[credentialName];
    if (!value || value.trim() === '') {
      warnings.push(`Optional credential missing: ${credentialName}`);
    }
  });

  const hasAllRequired = missingCredentials.length === 0;
  const isValid = hasAllRequired; // For now, we only require the essential ones

  return {
    isValid,
    missingCredentials,
    warnings,
    hasAllRequired
  };
}

/**
 * Get user-friendly error message for missing credentials
 */
export function getCredentialErrorMessage(validation: CredentialValidationResult): string {
  if (validation.isValid) {
    return '';
  }

  let message = 'Amazon API Integration Not Available\n\n';

  if (validation.missingCredentials.length > 0) {
    message += 'Missing required credentials:\n';
    validation.missingCredentials.forEach(cred => {
      message += `• ${cred}\n`;
    });
    message += '\n';
  }

  message += 'Match Buy Box feature requires proper Amazon API configuration.\n';
  message += 'Please contact your administrator to set up these credentials.\n\n';
  message += 'For now, price updates must be done manually in Amazon Seller Central.';

  return message;
}

/**
 * Log credential validation status (for server-side logging)
 */
export function logCredentialStatus(validation: CredentialValidationResult): void {
  if (validation.isValid) {
    console.log('✅ Amazon API credentials validated successfully');
    if (validation.warnings.length > 0) {
      console.log('⚠️ Warnings:', validation.warnings);
    }
  } else {
    console.error('❌ Amazon API credentials validation failed');
    console.error('Missing:', validation.missingCredentials);
    if (validation.warnings.length > 0) {
      console.error('Warnings:', validation.warnings);
    }
  }
}
