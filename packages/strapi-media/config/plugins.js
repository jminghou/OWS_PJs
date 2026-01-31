module.exports = ({ env }) => {
  const gcsEnabled = env('GCS_BUCKET_NAME', '') !== '';

  // Base plugins config (always needed for production)
  const baseConfig = {
    'users-permissions': {
      config: {
        jwtSecret: env('JWT_SECRET', 'defaultJwtSecretForDev123456'),
      },
    },
  };

  // If GCS is not configured, use default local storage
  if (!gcsEnabled) {
    console.log('[Strapi] GCS not configured, using local storage');
    return baseConfig;
  }

  // Parse GCS service account JSON from environment variable
  let serviceAccount;
  const gcsJson = env('GCS_SERVICE_ACCOUNT_JSON', '');

  if (!gcsJson) {
    console.warn('[Strapi] GCS_BUCKET_NAME set but GCS_SERVICE_ACCOUNT_JSON is missing, falling back to local storage');
    return baseConfig;
  }

  try {
    serviceAccount = JSON.parse(gcsJson);
    console.log('[Strapi] GCS service account loaded successfully');
  } catch (e) {
    console.error('[Strapi] Failed to parse GCS_SERVICE_ACCOUNT_JSON:', e.message);
    console.warn('[Strapi] Falling back to local storage');
    return baseConfig;
  }

  // Validate service account has required fields
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    console.error('[Strapi] GCS service account missing required fields (project_id, client_email, or private_key)');
    console.warn('[Strapi] Falling back to local storage');
    return baseConfig;
  }

  console.log(`[Strapi] Configuring GCS upload to bucket: ${env('GCS_BUCKET_NAME')}`);

  return {
    ...baseConfig,
    upload: {
      config: {
        provider: '@strapi-community/strapi-provider-upload-google-cloud-storage',
        providerOptions: {
          bucketName: env('GCS_BUCKET_NAME'),
          publicFiles: true,
          uniform: true,
          basePath: env('GCS_BASE_PATH', 'media'),
          serviceAccount,
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
    },
  };
};
