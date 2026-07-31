import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../utils/db.js';
import { authenticateToken, requireSuperAdmin, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';

export const superAdminRouter = Router();

// Protect all routes with Super Admin check
superAdminRouter.use(authenticateToken);
superAdminRouter.use(requireSuperAdmin);

// ─────────────────────────────────────────────
// 1. Get Super Admin Dashboard Stats
// ─────────────────────────────────────────────
superAdminRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalLabs,
      activeLabs,
      inactiveLabs,
      licenseExpiring,
      totalReports,
      totalTechnicians,
      aiRequestsAgg
    ] = await Promise.all([
      prisma.laboratory.count({ where: { deletedAt: null } }),
      prisma.laboratory.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.laboratory.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
      prisma.laboratory.count({ where: { licenseExpiry: { lte: thirtyDaysLater, gte: now }, deletedAt: null } }),
      prisma.report.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: 'TECHNICIAN', deletedAt: null } }),
      prisma.license.aggregate({
        _sum: { geminiQuotaCount: true }
      })
    ]);

    // Calculate actual DB storage size in MB
    let storageMB = 4.8;
    try {
      const dbPath = path.resolve('prisma/lrms.db');
      if (fs.existsSync(dbPath)) {
        storageMB = fs.statSync(dbPath).size / 1024 / 1024;
      }
    } catch (e) {}

    res.json({
      totalLabs,
      activeLabs,
      inactiveLabs,
      licenseExpiring,
      totalReports,
      totalTechnicians,
      totalStorage: `${storageMB.toFixed(2)} MB`,
      aiRequests: aiRequestsAgg._sum.geminiQuotaCount || 0,
      revenue: 0 // Future use
    });
  } catch (error: any) {
    logger.error('SuperAdmin: Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 2. Get all Laboratories
// ─────────────────────────────────────────────
superAdminRouter.get('/labs', async (req: Request, res: Response) => {
  try {
    const labs = await prisma.laboratory.findMany({
      where: { deletedAt: null },
      include: {
        licenses: true,
        _count: {
          select: { users: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(labs);
  } catch (error: any) {
    logger.error('SuperAdmin: Error fetching labs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 3. Create a new Laboratory
// ─────────────────────────────────────────────
superAdminRouter.post('/labs', async (req: Request, res: Response) => {
  try {
    const { name, ownerName, phone, email, address, logo, licenseExpiry, subscription } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Laboratory name is required' });
    }

    const expiryDate = licenseExpiry ? new Date(licenseExpiry) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const newLab = await prisma.laboratory.create({
      data: {
        name,
        ownerName: ownerName || 'N/A',
        phone: phone || 'N/A',
        email: email || 'N/A',
        address: address || 'N/A',
        logo: logo || null,
        licenseExpiry: expiryDate,
        subscription: subscription || 'ACTIVE',
        status: 'ACTIVE'
      }
    });

    // Create associated License record
    await prisma.license.create({
      data: {
        labName: name,
        licenseType: 'SINGLE',
        maxDevices: 5,
        status: 'ACTIVE',
        expiryDate: expiryDate,
        activationDate: new Date(),
        laboratoryId: newLab.id
      }
    });

    logger.info(`SuperAdmin: Registered new laboratory "${name}" (ID: ${newLab.id})`);
    res.status(201).json(newLab);
  } catch (error: any) {
    logger.error('SuperAdmin: Error registering lab:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 4. Update Laboratory Config & API Keys
// ─────────────────────────────────────────────
superAdminRouter.put('/labs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      ownerName,
      phone,
      email,
      address,
      logo,
      licenseExpiry,
      subscription,
      status,
      geminiApiKey,
      openaiApiKey,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFromEmail,
      smtpFromName,
      whatsappApiKey,
      whatsappPhoneId
    } = req.body;

    const updatedLab = await prisma.laboratory.update({
      where: { id },
      data: {
        name,
        ownerName,
        phone,
        email,
        address,
        logo,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : undefined,
        subscription,
        status,
        geminiApiKey,
        openaiApiKey,
        smtpHost,
        smtpPort: smtpPort ? Number(smtpPort) : undefined,
        smtpUser,
        smtpPass,
        smtpFromEmail,
        smtpFromName,
        whatsappApiKey,
        whatsappPhoneId
      }
    });

    // Sync license lab name and status if changed
    await prisma.license.updateMany({
      where: { laboratoryId: id },
      data: {
        labName: name || undefined,
        status: status || undefined,
        expiryDate: licenseExpiry ? new Date(licenseExpiry) : undefined
      }
    });

    logger.info(`SuperAdmin: Updated laboratory configurations for lab ID ${id}`);
    res.json(updatedLab);
  } catch (error: any) {
    logger.error('SuperAdmin: Error updating lab:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 5. Delete a Laboratory (Soft Delete)
// ─────────────────────────────────────────────
superAdminRouter.delete('/labs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (id === 'default-lab') {
      return res.status(400).json({ error: 'Cannot delete default laboratory' });
    }

    const updated = await prisma.laboratory.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'SUSPENDED'
      }
    });

    // Suspend users associated with this lab
    await prisma.user.updateMany({
      where: { laboratoryId: id },
      data: { isActive: false }
    });

    logger.info(`SuperAdmin: Soft-deleted laboratory ID ${id}`);
    res.json({ success: true, lab: updated });
  } catch (error: any) {
    logger.error('SuperAdmin: Error soft deleting lab:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 6. Get all Technicians for a Lab
// ─────────────────────────────────────────────
superAdminRouter.get('/labs/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const users = await prisma.user.findMany({
      where: { laboratoryId: id, deletedAt: null },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        laboratoryId: true
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
// 7. Create a Technician for a Lab
// ─────────────────────────────────────────────
superAdminRouter.post('/labs/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password, name } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'username, password, and name are required' });
    }

    // Verify lab exists
    const lab = await prisma.laboratory.findFirst({ where: { id, deletedAt: null } });
    if (!lab) {
      return res.status(404).json({ error: 'Laboratory not found' });
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
        role: 'TECHNICIAN', // STRICTLY technician only (no lab admin)
        isActive: true,
        laboratoryId: id
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        laboratoryId: true
      }
    });

    // Create default technician preferences/settings
    await prisma.technicianSettings.create({
      data: {
        userId: newUser.id,
        theme: 'light',
        language: 'en',
        printerName: '',
        paperSize: 'A4',
        margins: 'normal'
      }
    });

    logger.info(`SuperAdmin: Created technician "${username}" for lab ID ${id}`);
    res.status(201).json(newUser);
  } catch (error: any) {
    logger.error('SuperAdmin: Error creating technician:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 8. Toggle User Active Status
// ─────────────────────────────────────────────
superAdminRouter.patch('/labs/:id/users/:userId/toggle', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === 'SUPER_ADMIN') {
      return res.status(404).json({ error: 'Technician not found' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true }
    });

    logger.info(`SuperAdmin: Toggled technician ${userId} active status to ${updated.isActive}`);
    res.json(updated);
  } catch (error: any) {
    logger.error('SuperAdmin: Error toggling technician status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 9. Reset User Password
// ─────────────────────────────────────────────
superAdminRouter.post('/labs/:id/users/:userId/reset-password', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === 'SUPER_ADMIN') {
      return res.status(404).json({ error: 'Technician not found' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    logger.info(`SuperAdmin: Reset password for technician ID ${userId}`);
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error: any) {
    logger.error('SuperAdmin: Error resetting technician password:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 10. Get Activity Logs for a laboratory
// ─────────────────────────────────────────────
superAdminRouter.get('/labs/:id/activity-logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const logs = await prisma.activityLog.findMany({
      where: { laboratoryId: id },
      include: {
        user: {
          select: { name: true, username: true }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (error: any) {
    logger.error('SuperAdmin: Error fetching activity logs:', error);
    res.status(500).json({ error: error.message });
  }
});
