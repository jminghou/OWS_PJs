module.exports = ({ env }) => {
  const gcsEnabled = env('GCS_BUCKET_NAME', '') !== '';

  // If GCS is not configured, use default local storage
  if (!gcsEnabled) {
    return {};
  }

  // Parse GCS service account JSON from environment variable
  let serviceAccount;
  const gcsJson = env('GCS_SERVICE_ACCOUNT_JSON', '');
  if (gcsJson) {
    try {
      serviceAccount = JSON.parse(gcsJson);
    } catch (e) {
      console.error('Failed to parse GCS_SERVICE_ACCOUNT_JSON:', e);
      return {};
    }
  }

  return {
    upload: {
      config: {
        provider: '@strapi-community/strapi-provider-upload-google-cloud-storage',
        providerOptions: {
          bucketName: env('GCS_BUCKET_NAME'),
          publicFiles: true,
          uniform: true,  // Bucket has uniform bucket-level access enabled
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
