import { Router, Request, Response, NextFunction } from 'express';
import { LicensingService } from './licensing.service.js';
import { authenticateToken } from '../auth/auth.middleware.js';
import { logger } from '../../utils/logger.js';

export const licensingRouter = Router();

// Get local machine fingerprint
licensingRouter.get('/fingerprint', async (req: Request, res: Response) => {
  try {
    const fingerprint = await LicensingService.getMachineFingerprint();
    res.json({ fingerprint });
  } catch (error: any) {
    logger.error('Error in fingerprint endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active license verification status
licensingRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await LicensingService.verifyLicense();
    res.json(status);
  } catch (error: any) {
    logger.error('Error in status endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Activate license key
licensingRouter.post('/activate', async (req: Request, res: Response) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Activation key is required.' });
    }

    const result = await LicensingService.activateLicense(key);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    logger.error('Error in activate endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate activation key (Super Admin use only)
licensingRouter.post('/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Super Admin role required.' });
    }

    const { labName, fingerprint, expiryDate, perpetual } = req.body;
    if (!labName || !fingerprint || (!expiryDate && !perpetual)) {
      return res.status(400).json({ error: 'Lab name, fingerprint, and expiry details are required.' });
    }

    const key = LicensingService.generateActivationKey(labName, fingerprint, expiryDate || '', perpetual === true);
    res.json({ success: true, key });
  } catch (error: any) {
    logger.error('Error in key generation endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// List registered devices (Super Admin use only)
licensingRouter.get('/devices', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    const devices = await LicensingService.listDevices();
    res.json(devices);
  } catch (error: any) {
    logger.error('Error listing devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve device (Super Admin use only)
licensingRouter.post('/devices/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    const { id } = req.params;
    const { labName, expiryDate } = req.body;
    if (!labName) {
      return res.status(400).json({ error: 'Laboratory name is required.' });
    }
    const device = await LicensingService.approveDevice(id, labName, expiryDate);
    res.json({ success: true, device });
  } catch (error: any) {
    logger.error('Error approving device:', error);
    res.status(500).json({ error: error.message });
  }
});

// Block device (Super Admin use only)
licensingRouter.post('/devices/:id/block', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    const { id } = req.params;
    const device = await LicensingService.blockDevice(id);
    res.json({ success: true, device });
  } catch (error: any) {
    logger.error('Error blocking device:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete device registration (Super Admin use only)
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

// Middleware to protect operational routes
export async function licenseGuard(req: Request, res: Response, next: NextFunction) {
  // Allow licensing endpoints themselves to pass
  if (req.path.startsWith('/licensing') || req.path.startsWith('/auth')) {
    return next();
  }

  const check = await LicensingService.verifyLicense();
  if (!check.isValid) {
    return res.status(403).json({ 
      error: 'LICENSE_REQUIRED', 
      message: check.message || 'Active laboratory license key required.' 
    });
  }

  next();
}
