describe('config module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://localhost/test',
      JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load jwt.secret from JWT_SECRET env var', async () => {
    const { config } = await import('../src/config/index');
    expect(config.jwt.secret).toBe('a-valid-secret-that-is-at-least-32-characters-long');
  });

  it('should load jwt.expiresIn from JWT_EXPIRES_IN env var', async () => {
    const { config } = await import('../src/config/index');
    expect(config.jwt.expiresIn).toBe('1h');
  });

  it('should throw if JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    await expect(import('../src/config/index')).rejects.toThrow('JWT_SECRET is required');
  });

  it('should throw if JWT_SECRET is empty', async () => {
    process.env.JWT_SECRET = '';
    await expect(import('../src/config/index')).rejects.toThrow('JWT_SECRET is required');
  });

  it('should throw if JWT_SECRET is shorter than 32 characters', async () => {
    process.env.JWT_SECRET = 'short-secret';
    await expect(import('../src/config/index')).rejects.toThrow(
      'JWT_SECRET must be at least 32 characters'
    );
  });

  it('should throw if JWT_EXPIRES_IN is missing', async () => {
    delete process.env.JWT_EXPIRES_IN;
    await expect(import('../src/config/index')).rejects.toThrow(
      'Missing required environment variable: JWT_EXPIRES_IN'
    );
  });

  it('should throw if JWT_EXPIRES_IN is empty', async () => {
    process.env.JWT_EXPIRES_IN = '';
    await expect(import('../src/config/index')).rejects.toThrow(
      'Missing required environment variable: JWT_EXPIRES_IN'
    );
  });

  it('should accept JWT_SECRET that is exactly 32 characters', async () => {
    process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz123456'; // 32 chars
    const { config } = await import('../src/config/index');
    expect(config.jwt.secret).toBe('abcdefghijklmnopqrstuvwxyz123456');
  });
});
