import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { z } from 'zod';
import { KnowledgeEngineService } from './knowledgeEngine.service.js';

export const parametersRouter = Router();
const mkeService = new KnowledgeEngineService();

// Get all parameters (paginated, with search filters)
parametersRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { category, isActive } = req.query;
    const where: any = { deletedAt: null };

    if (category) {
      where.category = category;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const parameters = await prisma.parameter.findMany({
      where,
      include: {
        unit: true,
        referenceRanges: {
          where: { deletedAt: null }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Formatting for front-end structure
    const formatted = parameters.map(p => ({
      ...p,
      aliases: p.aliases ? p.aliases.split(',') : []
    }));

    res.json(formatted);
  } catch (error: any) {
    logger.error('Error fetching parameters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new parameter
parametersRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      shortCode: z.string().min(1),
      aliases: z.array(z.string()).optional(),
      category: z.string().min(1),
      unitId: z.string().min(1),
      decimalPrecision: z.number().int().min(0).max(4).default(2),
      description: z.string().optional().nullable(),
      referenceRanges: z.array(z.object({
        gender: z.enum(['MALE', 'FEMALE', 'ALL']),
        ageMin: z.number().nonnegative(),
        ageMax: z.number().positive(),
        minVal: z.number().optional().nullable(),
        maxVal: z.number().optional().nullable(),
        displayText: z.string(),
        condition: z.string().default('ADULT')
      })).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const {
      name,
      shortCode,
      aliases = [],
      category,
      unitId,
      decimalPrecision,
      description,
      referenceRanges = []
    } = parsed.data;

    // Check duplicate prevention
    const duplicates = await mkeService.detectDuplicateParameter(name, shortCode, aliases);
    if (duplicates.length > 0) {
      return res.status(400).json({
        error: 'Duplicate parameter detected',
        duplicates: duplicates.map(d => ({
          name: d.name,
          shortCode: d.shortCode,
          unit: d.unit.name
        }))
      });
    }

    const newParam = await prisma.parameter.create({
      data: {
        name,
        shortCode,
        aliases: aliases.join(','),
        category,
        unitId,
        decimalPrecision,
        description,
        isActive: true
      }
    });

    // Create reference ranges if provided
    if (referenceRanges.length > 0) {
      await prisma.referenceRange.createMany({
        data: referenceRanges.map(range => ({
          parameterId: newParam.id,
          gender: range.gender,
          ageMin: range.ageMin,
          ageMax: range.ageMax,
          minVal: range.minVal ?? null,
          maxVal: range.maxVal ?? null,
          displayText: range.displayText,
          condition: range.condition
        }))
      });
    }

    // Rebuild Search index in background
    mkeService.rebuildSearchIndex();

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE_PARAMETER',
        details: `Created master parameter: ${newParam.name} (${newParam.shortCode})`
      }
    });

    const fullParam = await prisma.parameter.findUnique({
      where: { id: newParam.id },
      include: { unit: true, referenceRanges: true }
    });

    res.status(201).json(fullParam);
  } catch (error: any) {
    logger.error('Error creating parameter:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update parameter and ranges
parametersRouter.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().optional(),
      shortCode: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      category: z.string().optional(),
      unitId: z.string().optional(),
      decimalPrecision: z.number().int().min(0).max(4).optional(),
      description: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
      referenceRanges: z.array(z.object({
        gender: z.enum(['MALE', 'FEMALE', 'ALL']),
        ageMin: z.number().nonnegative(),
        ageMax: z.number().positive(),
        minVal: z.number().optional().nullable(),
        maxVal: z.number().optional().nullable(),
        displayText: z.string(),
        condition: z.string()
      })).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const param = await prisma.parameter.findUnique({ where: { id } });
    if (!param || param.deletedAt) {
      return res.status(404).json({ error: 'Parameter not found' });
    }

    const { referenceRanges, aliases, ...rest } = parsed.data;

    // Perform updates
    await prisma.parameter.update({
      where: { id },
      data: {
        ...rest,
        aliases: aliases ? aliases.join(',') : param.aliases
      }
    });

    // Rewrite reference ranges if provided
    if (referenceRanges !== undefined) {
      await prisma.referenceRange.deleteMany({
        where: { parameterId: id }
      });

      if (referenceRanges.length > 0) {
        await prisma.referenceRange.createMany({
          data: referenceRanges.map(range => ({
            parameterId: id,
            gender: range.gender,
            ageMin: range.ageMin,
            ageMax: range.ageMax,
            minVal: range.minVal ?? null,
            maxVal: range.maxVal ?? null,
            displayText: range.displayText,
            condition: range.condition
          }))
        });
      }
    }

    // Rebuild Search index in background
    mkeService.rebuildSearchIndex();

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE_PARAMETER',
        details: `Updated master parameter details: ${param.name}`
      }
    });

    const fullParam = await prisma.parameter.findUnique({
      where: { id },
      include: { unit: true, referenceRanges: true }
    });

    res.json(fullParam);
  } catch (error: any) {
    logger.error('Error updating parameter:', error);
    res.status(500).json({ error: error.message });
  }
});

// Soft Delete parameter
parametersRouter.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const param = await prisma.parameter.findUnique({ where: { id } });
    if (!param || param.deletedAt) {
      return res.status(404).json({ error: 'Parameter not found' });
    }

    await prisma.parameter.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });

    // Rebuild Search index in background
    mkeService.rebuildSearchIndex();

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'DELETE_PARAMETER',
        details: `Deleted master parameter: ${param.name}`
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting parameter:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk Soft Delete parameters
parametersRouter.post('/bulk-delete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of parameter IDs is required' });
    }

    await prisma.parameter.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date(), isActive: false }
    });

    // Rebuild Search index in background
    mkeService.rebuildSearchIndex();

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'BULK_DELETE_PARAMETERS',
        details: `Bulk deleted ${ids.length} parameters`
      }
    });

    res.json({ success: true, message: `Successfully bulk-deleted ${ids.length} parameters` });
  } catch (error: any) {
    logger.error('Error bulk deleting parameters:', error);
    res.status(500).json({ error: error.message });
  }
});

