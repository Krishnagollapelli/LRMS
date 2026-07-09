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
