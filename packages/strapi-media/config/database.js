const path = require('path');

module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  // For postgres, prefer DATABASE_URL if available
  if (client === 'postgres') {
    const databaseUrl = env('DATABASE_URL');

    if (databaseUrl) {
      // Use DATABASE_URL (Railway provides this)
      return {
        connection: {
          client: 'postgres',
          connection: {
            connectionString: databaseUrl,
            ssl: env.bool('DATABASE_SSL', false) ? {
              rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
            } : false,
          },
          pool: {
            min: env.int('DATABASE_POOL_MIN', 2),
            max: env.int('DATABASE_POOL_MAX', 10)
          },
          acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
        },
      };
    }

    // Fallback to individual connection params
    return {
      connection: {
        client: 'postgres',
        connection: {
          host: env('DATABASE_HOST', 'localhost'),
          port: env.int('DATABASE_PORT', 5432),
          database: env('DATABASE_NAME', 'strapi'),
          user: env('DATABASE_USERNAME', 'strapi'),
          password: env('DATABASE_PASSWORD', 'strapi'),
          ssl: env.bool('DATABASE_SSL', false) ? {
            rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
          } : false,
          schema: env('DATABASE_SCHEMA', 'public'),
        },
        pool: {
          min: env.int('DATABASE_POOL_MIN', 2),
          max: env.int('DATABASE_POOL_MAX', 10)
        },
        acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
      },
    };
  }

  // SQLite (default for local development)
  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: path.join(__dirname, '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};
