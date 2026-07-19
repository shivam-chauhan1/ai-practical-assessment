const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: requiredEnv('DATABASE_URL'),
  nodeEnv: process.env.NODE_ENV || 'development',
};
