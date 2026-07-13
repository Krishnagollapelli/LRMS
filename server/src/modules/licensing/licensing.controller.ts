import { Router, Request, Response, NextFunction } from 'express';
import { LicensingService } from './licensing.service.js';
import { authenticateToken } from '../auth/auth.middleware.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const licensingRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lrms-secret-key-2026';

// Get active license verification status
licensingRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const clientType = req.headers['x-client-type'] as string;
    const deviceId = req.headers['x-device-id'] as string;

    // 1. Dev / Demo Bypass
    if (process.env.NODE_ENV !== 'production' || process.env.DEV_MODE === 'true' || clientType !== 'Electron') {
      return res.json({ isValid: true, details: { demo: clientType !== 'Electron' } });
    }

    // 2. Check if database has any licenses configured
    const count = await prisma.license.count();
    if (count === 0) {
      return res.json({ isValid: true, firstLaunch: true });
    }

    // 3. Verify specific authenticated user request
    let userId: string | undefined = undefined;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded?.id;
      } catch (e) {}
    }

    const check = await LicensingService.verifyDeviceRequest(userId, deviceId);
    res.json(check);
  } catch (error: any) {
    res.json({ isValid: false, message: error.message });
  }
});

// List all licenses (Admin use only)
licensingRouter.get('/licenses', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    const licenses = await LicensingService.listLicenses();
    res.json(licenses);
  } catch (error: any) {
    logger.error('Error listing licenses:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new license (Admin use only)
licensingRouter.post('/licenses', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    const { labName, licenseType, maxDevices, expiryDate } = req.body;
    if (!labName || !licenseType || !maxDevices) {
      return res.status(400).json({ error: 'Laboratory Name, Type, and Max Devices are required.' });
    }
    const license = await LicensingService.createLicense({ labName, licenseType, maxDevices, expiryDate });
    res.json({ success: true, license });
  } catch (error: any) {
    logger.error('Error creating license:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset all devices on a license (Admin use only)
licensingRouter.post('/licenses/:id/reset', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    const { id } = req.params;
    await LicensingService.resetLicenseDevices(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error resetting license devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete specific registered device (Admin use only)
licensingRouter.delete('/devices/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    const { id } = req.params;
    await LicensingService.deleteDevice(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting device:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create first Laboratory Super Admin account linked to a license (Admin use only)
licensingRouter.post('/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    const { username, password, name, role, licenseId } = req.body;
    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'Username, password, name, and role are required.' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        password: hashedPassword,
        name,
        role,
        licenseId,
        isActive: true
      }
    });

    res.json({ success: true, userId: newUser.id });
  } catch (error: any) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware to protect operational routes
export async function licenseGuard(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith('/licensing') || req.path.startsWith('/auth')) {
    return next();
  }

  let userId: string | undefined = undefined;
  let userRole: string | undefined = undefined;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded?.id;
      userRole = decoded?.role;
    } catch (e) {
      return next(); // Invalid token handling occurs at auth middles later
    }
  }

  if (userRole === 'SUPER_ADMIN') {
    return next();
  }

  const deviceId = req.headers['x-device-id'] as string;
  const check = await LicensingService.verifyDeviceRequest(userId, deviceId);
  
  if (!check.isValid) {
    return res.status(403).json({ 
      error: 'LICENSE_REQUIRED', 
      message: check.message || 'Active laboratory license key required.' 
    });
  }

  next();
}
