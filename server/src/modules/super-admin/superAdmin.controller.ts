import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../utils/db.js';
import { authenticateToken, requireSuperAdmin, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { logger } from '../../utils/logger.js';

export const superAdminRouter = Router();

// Protect all routes with Super Admin check
superAdminRouter.use(authenticateToken);
superAdminRouter.use(requireSuperAdmin);

// ─────────────────────────────────────────────
// 1. Get all labs / licenses
// ─────────────────────────────────────────────
superAdminRouter.get('/labs', async (req: Request, res: Response) => {
  try {
    const licenses = await prisma.license.findMany({
      include: {
        _count: {
          select: { users: true, devices: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(licenses);
  } catch (error: any) {
    logger.error('SuperAdmin: Error fetching labs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 2. Register a new lab / license
// ─────────────────────────────────────────────
superAdminRouter.post('/labs', async (req: Request, res: Response) => {
  try {
    const { labName, licenseType, maxDevices, expiryDate } = req.body;
    if (!labName) {
      return res.status(400).json({ error: 'Lab name is required' });
    }

    const newLicense = await prisma.license.create({
      data: {
        labName,
        licenseType: licenseType || 'SINGLE',
        maxDevices: maxDevices ? Number(maxDevices) : 1,
        status: 'ACTIVE',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        activationDate: new Date()
      }
    });

    logger.info(`SuperAdmin: Registered new lab "${labName}" with license ID ${newLicense.id}`);
    res.status(201).json(newLicense);
  } catch (error: any) {
    logger.error('SuperAdmin: Error registering lab:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 3. Update lab configurations — email fields removed
// ─────────────────────────────────────────────
superAdminRouter.put('/labs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      labName,
      licenseType,
      maxDevices,
      status,
      expiryDate,
      geminiApiKey,
      geminiQuotaLimit,
      whatsappEnabled,
      whatsappApiKey,
      whatsappPhoneId
    } = req.body;

    const updatedLicense = await prisma.license.update({
      where: { id },
      data: {
        labName,
        licenseType,
        maxDevices: maxDevices !== undefined ? Number(maxDevices) : undefined,
        status,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        geminiApiKey: geminiApiKey !== undefined ? geminiApiKey : undefined,
        geminiQuotaLimit: geminiQuotaLimit !== undefined ? Number(geminiQuotaLimit) : undefined,
        whatsappEnabled: whatsappEnabled !== undefined ? Boolean(whatsappEnabled) : undefined,
        whatsappApiKey: whatsappApiKey !== undefined ? whatsappApiKey : undefined,
        whatsappPhoneId: whatsappPhoneId !== undefined ? whatsappPhoneId : undefined
      }
    });

    logger.info(`SuperAdmin: Configured settings for lab ID ${id}`);
    res.json(updatedLicense);
  } catch (error: any) {
    logger.error('SuperAdmin: Error updating lab config:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 4. Reset Gemini validation quota count
// ─────────────────────────────────────────────
superAdminRouter.post('/labs/:id/quota-reset', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await prisma.license.update({
      where: { id },
      data: { geminiQuotaCount: 0 }
    });

    logger.info(`SuperAdmin: Reset Gemini quota counter to 0 for lab ID ${id}`);
    res.json({ success: true, license: updated });
  } catch (error: any) {
    logger.error('SuperAdmin: Error resetting quota:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 5. Reset registered devices for a license
// ─────────────────────────────────────────────
superAdminRouter.post('/labs/:id/devices-reset', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.registeredDevice.deleteMany({
      where: { licenseId: id }
    });

    logger.info(`SuperAdmin: Cleared all registered devices for lab ID ${id}`);
    res.json({ success: true, message: 'All registered devices cleared successfully.' });
  } catch (error: any) {
    logger.error('SuperAdmin: Error resetting devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 6. Get all users for a specific lab
// ─────────────────────────────────────────────
superAdminRouter.get('/labs/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const users = await prisma.user.findMany({
      where: { licenseId: id, deletedAt: null },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        licenseId: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(users);
  } catch (error: any) {
    logger.error('SuperAdmin: Error fetching lab users:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 7. Create a user for a specific lab
// ─────────────────────────────────────────────
superAdminRouter.post('/labs/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password, name, role } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'username, password, and name are required' });
    }
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      return res.status(400).json({ error: 'Role must be ADMIN or TECHNICIAN' });
    }

    // Verify lab exists
    const lab = await prisma.license.findUnique({ where: { id } });
    if (!lab) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    // Check username uniqueness
    const existing = await prisma.user.findFirst({ where: { username: username.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        password: hashedPassword,
        name,
        role,
        isActive: true,
        licenseId: id
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        licenseId: true
      }
    });

    logger.info(`SuperAdmin: Created user "${username}" for lab ID ${id}`);
    res.status(201).json(newUser);
  } catch (error: any) {
    logger.error('SuperAdmin: Error creating lab user:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 8. Toggle user active status for a lab
// ─────────────────────────────────────────────
superAdminRouter.patch('/labs/:id/users/:userId/toggle', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === 'SUPER_ADMIN') {
      return res.status(404).json({ error: 'User not found or cannot toggle super admin' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true }
    });

    logger.info(`SuperAdmin: Toggled user ${userId} to isActive=${updated.isActive}`);
    res.json(updated);
  } catch (error: any) {
    logger.error('SuperAdmin: Error toggling user status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 9. Delete a user from a lab (soft delete)
// ─────────────────────────────────────────────
superAdminRouter.delete('/labs/:id/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === 'SUPER_ADMIN') {
      return res.status(404).json({ error: 'User not found or cannot delete super admin' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false }
    });

    logger.info(`SuperAdmin: Soft-deleted user ${userId}`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('SuperAdmin: Error deleting lab user:', error);
    res.status(500).json({ error: error.message });
  }
});
