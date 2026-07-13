import { Router, Request, Response } from 'express';
import { KnowledgeEngineService } from './knowledgeEngine.service.js';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';
import { testsRouter } from './tests.controller.js';
import { parametersRouter } from './parameters.controller.js';
import { authenticateToken } from '../auth/auth.middleware.js';

export const mkeRouter = Router();
const mkeService = new KnowledgeEngineService();

// Mount sub-modules
mkeRouter.use('/tests', testsRouter);
mkeRouter.use('/parameters', parametersRouter);

// Trigger database seeding manually if required (normally run on startup)
mkeRouter.post('/seed', async (req: Request, res: Response) => {
  try {
    const force = req.body.force === true;
    await mkeService.seedDatabase(force);
    res.json({ success: true, message: 'Medical Knowledge Engine seeded.' });
  } catch (error: any) {
    logger.error('Error during manual seeding:', error);
    res.status(500).json({ error: error.message });
  }
});

// Autocomplete and fuzzy search parameters
mkeRouter.get('/search/parameters', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const results = await mkeService.searchParameters(q);
    res.json(results);
  } catch (error: any) {
    logger.error('Error searching parameters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Autocomplete and fuzzy search tests
mkeRouter.get('/search/tests', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const results = await mkeService.searchTests(q);
    res.json(results);
  } catch (error: any) {
    logger.error('Error searching tests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Autocomplete and fuzzy search parameters (legacy alias)
mkeRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const results = await mkeService.searchParameters(q);
    res.json(results);
  } catch (error: any) {
    logger.error('Error searching parameters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if parameter violates duplicate prevention rules
mkeRouter.get('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const name = (req.query.name as string) || '';
    const code = (req.query.code as string) || '';
    const aliasesRaw = (req.query.aliases as string) || '';
    const aliases = aliasesRaw ? aliasesRaw.split(',') : [];

    if (!name && !code) {
      return res.status(400).json({ error: 'Either name or code is required' });
    }

    const duplicates = await mkeService.detectDuplicateParameter(name, code, aliases);
    res.json({
      duplicateFound: duplicates.length > 0,
      matches: duplicates.map(d => ({
        id: d.id,
        name: d.name,
        shortCode: d.shortCode,
        unit: d.unit.name,
        displayText: d.referenceRanges?.[0]?.displayText || 'No default range'
      }))
    });
  } catch (error: any) {
    logger.error('Error checking duplicate parameter:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve reference range dynamically based on age and gender
mkeRouter.post('/range/resolve', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      parameterId: z.string(),
      age: z.number().nullable().optional(),
      gender: z.string().nullable().optional(),
      condition: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const { parameterId, age, gender, condition } = parsed.data;
    const range = await mkeService.resolveReferenceRange(parameterId, age, gender, condition);

    if (!range) {
      return res.status(455).json({ error: 'No matching reference range found' }); // Return success-like non-crashing status or fallback
    }

    res.json(range);
  } catch (error: any) {
    logger.error('Error resolving reference range:', error);
    res.status(500).json({ error: error.message });
  }
});

// Normalize custom units (upsert database record on write request)
mkeRouter.post('/units/normalize', authenticateToken, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      unit: z.string()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    let geminiApiKey: string | undefined;
    const licenseId = (req as any).user?.licenseId;

    if (licenseId) {
      const license = await prisma.license.findUnique({
        where: { id: licenseId }
      });
      if (license) {
        if (license.geminiQuotaCount >= license.geminiQuotaLimit) {
          return res.status(429).json({ error: 'QUOTA_EXCEEDED', message: 'Gemini AI quota limit exceeded for this laboratory license.' });
        }
        geminiApiKey = license.geminiApiKey;
      }
    }

    // Fallback to global setting
    if (!geminiApiKey) {
      const apiSetting = await prisma.setting.findUnique({
        where: { key: 'lab_settings' }
      });
      if (apiSetting) {
        try {
          const settingsObj = JSON.parse(apiSetting.value);
          geminiApiKey = settingsObj.geminiApiKey;
        } catch (e) {}
      }
    }

    const result = await mkeService.normalizeUnit(parsed.data.unit, geminiApiKey);
    
    // Increment quota count
    if (result && licenseId) {
      await prisma.license.update({
        where: { id: licenseId },
        data: { geminiQuotaCount: { increment: 1 } }
      });
    }

    // Find or create Unit record in the database
    let unitRecord = await prisma.unit.findFirst({
      where: { name: { equals: result.standardName } }
    });

    if (!unitRecord) {
      unitRecord = await prisma.unit.create({
        data: {
          name: result.standardName,
          description: 'Standardized Custom Unit'
        }
      });
    }

    res.json({
      ...result,
      unitId: unitRecord.id
    });
  } catch (error: any) {
    logger.error('Error normalizing unit:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI lookup of new parameters using Gemini API configuration
mkeRouter.get('/ai-resolve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let geminiApiKey: string | undefined;
    const licenseId = (req as any).user?.licenseId;

    if (licenseId) {
      const license = await prisma.license.findUnique({
        where: { id: licenseId }
      });
      if (license) {
        if (license.geminiQuotaCount >= license.geminiQuotaLimit) {
          return res.status(429).json({ error: 'QUOTA_EXCEEDED', message: 'Gemini AI quota limit exceeded for this laboratory license.' });
        }
        geminiApiKey = license.geminiApiKey;
      }
    }

    // Fallback to global settings
    if (!geminiApiKey) {
      const apiSetting = await prisma.setting.findUnique({
        where: { key: 'lab_settings' }
      });
      if (apiSetting) {
        try {
          const settingsObj = JSON.parse(apiSetting.value);
          geminiApiKey = settingsObj.geminiApiKey;
        } catch (e) {}
      }
    }

    const resolved = await mkeService.resolveParameterAI(q, geminiApiKey);

    // Increment quota count
    if (resolved && licenseId) {
      await prisma.license.update({
        where: { id: licenseId },
        data: { geminiQuotaCount: { increment: 1 } }
      });
    }

    res.json(resolved);
  } catch (error: any) {
    logger.error('Error resolving parameter via AI:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger seeding on startup automatically
mkeService.seedDatabase();
