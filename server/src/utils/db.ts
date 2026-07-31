import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is undefined! Please configure it in your production dashboard.');
} else {
  logger.info('Prisma Client initialized with cloud PostgreSQL database.');
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
