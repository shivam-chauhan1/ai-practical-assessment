import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticationError } from '../errors';

const prisma = new PrismaClient();

export interface LoginResult {
  token: string;
  user: { id: string; name: string; email: string; role: string };
}

/**
 * Authenticates a user by email and password.
 * - Looks up user by email
 * - Compares password against stored bcrypt hash
 * - On match: signs a JWT with { id, email, role } claims
 * - On mismatch or user-not-found: throws AuthenticationError
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AuthenticationError();
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AuthenticationError();
  }

  const signOptions: SignOptions = {
    expiresIn: config.jwt.expiresIn as unknown as SignOptions['expiresIn'],
  };

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    signOptions
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}
