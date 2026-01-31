const path = require('path');

module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  // Debug: log database client
  console.log('[Database Config] CLIENT:', client);

  if (client === 'postgres') {
    const databaseUrl = env('DATABASE_URL', '');

    return {
      connection: {
        client: 'postgres',
        connection: databaseUrl || {
          host: env('DATABASE_HOST', 'localhost'),
          port: env.int('DATABASE_PORT', 5432),
          database: env('DATABASE_NAME', 'strapi'),
          user: env('DATABASE_USERNAME', 'strapi'),
          password: env('DATABASE_PASSWORD', 'strapi'),
          schema: env('DATABASE_SCHEMA', 'public'),
        },
        pool: {
          min: env.int('DATABASE_POOL_MIN', 2),
          max: env.int('DATABASE_POOL_MAX', 10),
        },
        acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
      },
    };
  }

  // SQLite for local development
  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: path.join(__dirname, '..', '.tmp', env('DATABASE_FILENAME', 'data.db')),
      },
      useNullAsDefault: true,
    },
  };
};
