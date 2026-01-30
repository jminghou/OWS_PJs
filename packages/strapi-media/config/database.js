const path = require('path');

module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  console.log(`[Strapi DB] Client: ${client}`);

  // For postgres, prefer DATABASE_URL if available
  if (client === 'postgres') {
    const databaseUrl = env('DATABASE_URL');

    console.log(`[Strapi DB] DATABASE_URL set: ${databaseUrl ? 'YES' : 'NO'}`);

    if (databaseUrl) {
      // Log partial URL for debugging (hide password)
      const urlParts = databaseUrl.match(/postgres(ql)?:\/\/([^:]+):[^@]+@([^:]+):(\d+)\/(.+)/);
      if (urlParts) {
        console.log(`[Strapi DB] Connecting to: ${urlParts[2]}@${urlParts[3]}:${urlParts[4]}/${urlParts[5]}`);
      } else {
        console.log(`[Strapi DB] DATABASE_URL format may be invalid`);
      }

      const sslEnabled = env.bool('DATABASE_SSL', false);
      console.log(`[Strapi DB] SSL: ${sslEnabled}`);

      return {
        connection: {
          client: 'postgres',
          connection: {
            connectionString: databaseUrl,
            ssl: sslEnabled ? {
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
    const host = env('DATABASE_HOST', 'localhost');
    const port = env.int('DATABASE_PORT', 5432);
    const database = env('DATABASE_NAME', 'strapi');
    const user = env('DATABASE_USERNAME', 'strapi');

    console.log(`[Strapi DB] Connecting to: ${user}@${host}:${port}/${database}`);

    return {
      connection: {
        client: 'postgres',
        connection: {
          host,
          port,
          database,
          user,
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
  console.log('[Strapi DB] Using SQLite');
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
