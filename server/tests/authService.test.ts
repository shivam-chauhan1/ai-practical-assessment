import { AuthenticationError } from '../src/errors';

// Mock Prisma client
jest.mock('@prisma/client', () => {
  const mockFindUnique = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: mockFindUnique,
      },
    })),
    __mockFindUnique: mockFindUnique,
  };
});

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

// Mock config
jest.mock('../src/config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-that-is-at-least-32-chars-long',
      expiresIn: '1h',
    },
  },
}));

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { login } from '../src/services/authService';

// Get the mock findUnique function
const { __mockFindUnique: mockFindUnique } = jest.requireMock('@prisma/client');

const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Alice Admin',
  email: 'alice@example.com',
  password: '$2b$10$hashedpasswordvalue1234567890abcdefghij',
  role: 'ADMIN',
  createdAt: new Date(),
};

describe('AuthService - login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return token and user on successful login', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

    const result = await login('alice@example.com', 'password123');

    expect(result).toEqual({
      token: 'mock-jwt-token',
      user: {
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
      },
    });
  });

  it('should throw AuthenticationError (401) when email is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(login('nonexistent@example.com', 'password123')).rejects.toThrow(
      AuthenticationError
    );
    await expect(login('nonexistent@example.com', 'password123')).rejects.toMatchObject({
      statusCode: 401,
    });

    // bcrypt.compare should NOT be called when user is not found
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('should throw AuthenticationError (401) when password is incorrect', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(login('alice@example.com', 'wrongpassword')).rejects.toThrow(
      AuthenticationError
    );
    await expect(login('alice@example.com', 'wrongpassword')).rejects.toMatchObject({
      statusCode: 401,
    });

    // jwt.sign should NOT be called when password is wrong
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('should call bcrypt.compare with the input password and stored hash', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

    await login('alice@example.com', 'password123');

    expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.password);
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });
});
