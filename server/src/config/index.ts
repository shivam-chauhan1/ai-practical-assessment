const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const requiredEnvMinLength = (key: string, min: number): string => {
  const value = process.env[key];
  if (!value) {
    console.error(`${key} is required`);
    throw new Error(`${key} is required`);
  }
  if (value.length < min) {
    console.error(`${key} must be at least ${min} characters`);
    throw new Error(`${key} must be at least ${min} characters`);
  }
  return value;
};

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: requiredEnv('DATABASE_URL'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: requiredEnvMinLength('JWT_SECRET', 32),
    expiresIn: requiredEnv('JWT_EXPIRES_IN'),
  },
};
