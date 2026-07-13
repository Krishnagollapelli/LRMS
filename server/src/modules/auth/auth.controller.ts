import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from './auth.middleware.js';
import { z } from 'zod';
import { LicensingService } from '../licensing/licensing.service.js';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lrms-secret-key-2026';

// User Login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      username: z.string(),
      password: z.string()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const { username, password } = parsed.data;
    const normalizedUsername = username.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: { username: normalizedUsername, deletedAt: null }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid username or inactive account' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_FAILURE',
          details: `Failed login attempt for user ${username} (Invalid password)`,
          ipAddress: req.ip
        }
      });
      return res.status(401).json({ error: 'Invalid password' });
    }



    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, licenseId: user.licenseId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        details: `User ${username} logged in successfully`,
        ipAddress: req.ip
      }
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error: any) {
    logger.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Current User Profile
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      isActive: user.isActive
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN ONLY USER CRUD ---

// Get all users
authRouter.get('/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });

    const sanitizedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt
    }));

    res.json(sanitizedUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user
authRouter.post('/users', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      username: z.string().min(3),
      password: z.string().min(6),
      name: z.string(),
      role: z.enum(['ADMIN', 'TECHNICIAN'])
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const { username, password, name, role } = parsed.data;

    // Check if username exists
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role,
        isActive: true
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE_USER',
        details: `Created user account: ${username} (${role})`
      }
    });

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      isActive: newUser.isActive
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle User status (Activate/Deactivate)
authRouter.patch('/users/:id/toggle', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Prevent deactivating own account
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot toggle status of own account' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'TOGGLE_USER_STATUS',
        details: `${updated.isActive ? 'Activated' : 'Deactivated'} user account: ${user.username}`
      }
    });

    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Soft Delete User
authRouter.delete('/users/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete own account' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'DELETE_USER',
        details: `Deleted user account: ${user.username}`
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
