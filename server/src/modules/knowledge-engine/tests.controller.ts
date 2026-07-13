import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { z } from 'zod';
import { KnowledgeEngineService } from './knowledgeEngine.service.js';

export const testsRouter = Router();
const mkeService = new KnowledgeEngineService();

// Autocomplete and fuzzy search tests
testsRouter.get('/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const results = await mkeService.searchTests(q);
    res.json(results);
  } catch (error: any) {
    logger.error('Error in tests search endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all tests templates
testsRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tests = await prisma.test.findMany({
      where: { deletedAt: null },
      include: {
        testParameters: {
          include: {
            parameter: {
              include: { unit: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Format output to return parameters sorted by sortOrder
    const formatted = tests.map(t => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      category: t.category,
      defaultPrice: t.defaultPrice,
      isActive: t.isActive,
      createdAt: t.createdAt,
      parameters: t.testParameters
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(tp => tp.parameter)
    }));

    res.json(formatted);
  } catch (error: any) {
    logger.error('Error fetching test templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single test details
testsRouter.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        testParameters: {
          include: {
            parameter: {
              include: { unit: true, referenceRanges: true }
            }
          }
        }
      }
    });

    if (!test || test.deletedAt) {
      return res.status(404).json({ error: 'Test template not found' });
    }

    const formatted = {
      id: test.id,
      name: test.name,
      shortCode: test.shortCode,
      category: test.category,
      defaultPrice: test.defaultPrice,
      isActive: test.isActive,
      parameters: test.testParameters
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(tp => ({
          ...tp.parameter,
          sortOrder: tp.sortOrder
        }))
    };

    res.json(formatted);
  } catch (error: any) {
    logger.error('Error fetching test template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new test panel template
testsRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      shortCode: z.string().min(1),
      category: z.string().min(1),
      defaultPrice: z.number().nonnegative().default(100),
      shortcut: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      displayOrder: z.number().int().optional().default(0),
      parameterIds: z.array(z.object({
        parameterId: z.string(),
        sortOrder: z.number().int().positive()
      })).min(1)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const { name, shortCode, category, defaultPrice = 100, shortcut, description, displayOrder, parameterIds } = parsed.data;

    // Create test record
    const newTest = await prisma.test.create({
      data: {
        name,
        shortCode,
        category,
        defaultPrice,
        shortcut: shortcut || null,
        description: description || null,
        displayOrder: displayOrder || 0,
        isActive: true
      }
    });

    // Create parameters association
    for (const p of parameterIds) {
      await prisma.testParameter.create({
        data: {
          testId: newTest.id,
          parameterId: p.parameterId,
          sortOrder: p.sortOrder
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE_TEST_TEMPLATE',
        details: `Created master test template: ${newTest.name} (${newTest.shortCode})`
      }
    });

    res.status(201).json(newTest);
  } catch (error: any) {
    logger.error('Error creating test template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Edit / Override master test template
testsRouter.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().optional(),
      shortCode: z.string().optional(),
      category: z.string().optional(),
      defaultPrice: z.number().nonnegative().optional(),
      shortcut: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      displayOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
      parameterIds: z.array(z.object({
        parameterId: z.string(),
        sortOrder: z.number().int().positive()
      })).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const test = await prisma.test.findUnique({ where: { id } });
    if (!test || test.deletedAt) {
      return res.status(404).json({ error: 'Test template not found' });
    }

    const { name, shortCode, category, defaultPrice, shortcut, description, displayOrder, isActive, parameterIds } = parsed.data;

    const updatedTest = await prisma.test.update({
      where: { id },
      data: {
        name: name ?? test.name,
        shortCode: shortCode ?? test.shortCode,
        category: category ?? test.category,
        defaultPrice: defaultPrice !== undefined ? defaultPrice : test.defaultPrice,
        shortcut: shortcut !== undefined ? shortcut : test.shortcut,
        description: description !== undefined ? description : test.description,
        displayOrder: displayOrder !== undefined ? displayOrder : test.displayOrder,
        isActive: isActive ?? test.isActive
      }
    });

    // If parameters array provided, delete current configuration and rewrite
    if (parameterIds) {
      await prisma.testParameter.deleteMany({
        where: { testId: id }
      });

      for (const p of parameterIds) {
        await prisma.testParameter.create({
          data: {
            testId: id,
            parameterId: p.parameterId,
            sortOrder: p.sortOrder
          }
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE_TEST_TEMPLATE',
        details: `Updated master template config for test: ${test.name}`
      }
    });

    res.json(updatedTest);
  } catch (error: any) {
    logger.error('Error updating test template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Duplicate master test template
testsRouter.post('/:id/duplicate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const test = await prisma.test.findUnique({
      where: { id },
      include: { testParameters: true }
    });

    if (!test || test.deletedAt) {
      return res.status(404).json({ error: 'Test template not found' });
    }

    // Clone top-level
    const duplicatedTest = await prisma.test.create({
      data: {
        name: `${test.name} (Copy)`,
        shortCode: `${test.shortCode}_C`,
        category: test.category,
        isActive: true
      }
    });

    // Clone linked parameters
    for (const tp of test.testParameters) {
      await prisma.testParameter.create({
        data: {
          testId: duplicatedTest.id,
          parameterId: tp.parameterId,
          sortOrder: tp.sortOrder
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'DUPLICATE_TEST_TEMPLATE',
        details: `Duplicated test panel: ${test.name} into ${duplicatedTest.name}`
      }
    });

    res.status(201).json(duplicatedTest);
  } catch (error: any) {
    logger.error('Error duplicating test template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Soft Delete test panel
testsRouter.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const test = await prisma.test.findUnique({ where: { id } });
    if (!test || test.deletedAt) {
      return res.status(404).json({ error: 'Test template not found' });
    }

    await prisma.test.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'DELETE_TEST_TEMPLATE',
        details: `Deleted test template: ${test.name}`
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting test template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk Soft Delete test panels
testsRouter.post('/bulk-delete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of test template IDs is required' });
    }

    await prisma.test.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date(), isActive: false }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'BULK_DELETE_TEST_TEMPLATES',
        details: `Bulk deleted ${ids.length} test templates`
      }
    });

    res.json({ success: true, message: `Successfully bulk-deleted ${ids.length} test templates` });
  } catch (error: any) {
    logger.error('Error bulk deleting test templates:', error);
    res.status(500).json({ error: error.message });
  }
});


// ─────────────────────────────────────────────
// Upload tests from JSON — bulk upsert by shortCode
// Format: { tests: [{ name, shortCode, category, defaultPrice?, parameters: [{name, shortCode, unit, ...}] }] }
// ─────────────────────────────────────────────
testsRouter.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const tests: any[] = req.body.tests;
    if (!Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({ error: 'tests array is required and must not be empty' });
    }

    let createdTests = 0, updatedTests = 0, createdParams = 0, skippedParams = 0;
    const errors: string[] = [];

    for (const testDef of tests) {
      try {
        const { name, shortCode, category, defaultPrice, shortcut, description, displayOrder, parameters: paramDefs = [] } = testDef;
        if (!name || !shortCode) { errors.push(`Skipping: missing name/shortCode`); continue; }
        const resolvedParamIds: { parameterId: string; sortOrder: number }[] = [];
        for (let i = 0; i < paramDefs.length; i++) {
          const pd = paramDefs[i];
          if (!pd.name || !pd.shortCode) { errors.push(`Skipping param in "${name}": missing name/shortCode`); continue; }
          const unitName = pd.unit || 'No Unit';
          let unit = await prisma.unit.findFirst({ where: { name: unitName } });
          if (!unit) unit = await prisma.unit.create({ data: { name: unitName } });
          let param = await prisma.parameter.findFirst({ where: { shortCode: pd.shortCode, deletedAt: null } });
          if (!param) {
            param = await prisma.parameter.create({ data: {
              name: pd.name, shortCode: pd.shortCode,
              category: pd.category || category || 'General',
              unitId: unit.id, decimalPrecision: pd.decimalPrecision ?? 2,
              aliases: Array.isArray(pd.aliases) ? pd.aliases.join(',') : (pd.aliases || ''),
              description: pd.description || null, isActive: true
            }});
            if (Array.isArray(pd.referenceRanges) && pd.referenceRanges.length > 0) {
              await prisma.referenceRange.createMany({ data: pd.referenceRanges.map((r: any) => ({
                parameterId: param!.id, gender: r.gender || 'ALL',
                ageMin: r.ageMin ?? 0, ageMax: r.ageMax ?? 120,
                minVal: r.minVal ?? null, maxVal: r.maxVal ?? null,
                displayText: r.displayText || '', condition: r.condition || 'ADULT'
              }))});
            }
            createdParams++;
          } else { skippedParams++; }
          resolvedParamIds.push({ parameterId: param.id, sortOrder: pd.sortOrder ?? i });
        }
        let existingTest = await prisma.test.findFirst({ where: { shortCode, deletedAt: null } });
        if (existingTest) {
          await prisma.test.update({ where: { id: existingTest.id },
            data: { name, category, defaultPrice: defaultPrice ?? 100, shortcut: shortcut || null, description: description || null, displayOrder: displayOrder ?? 0 }
          });
          await prisma.testParameter.deleteMany({ where: { testId: existingTest.id } });
          if (resolvedParamIds.length > 0)
            await prisma.testParameter.createMany({ data: resolvedParamIds.map(r => ({ testId: existingTest!.id, ...r })) });
          updatedTests++;
        } else {
          const newTest = await prisma.test.create({ data: {
            name, shortCode, category, defaultPrice: defaultPrice ?? 100,
            shortcut: shortcut || null, description: description || null, displayOrder: displayOrder ?? 0, isActive: true
          }});
          if (resolvedParamIds.length > 0)
            await prisma.testParameter.createMany({ data: resolvedParamIds.map(r => ({ testId: newTest.id, ...r })) });
          createdTests++;
        }
      } catch (testErr: any) { errors.push(`Error on "${testDef?.name}": ${testErr.message}`); }
    }

    mkeService.rebuildSearchIndex();
    await prisma.auditLog.create({ data: {
      userId: req.user?.id, action: 'UPLOAD_TESTS',
      details: `Uploaded: ${createdTests} new, ${updatedTests} updated, ${createdParams} params created, ${skippedParams} reused`
    }});

    res.json({ success: true, summary: { createdTests, updatedTests, createdParams, skippedParams, errors: errors.length }, errors: errors.slice(0, 20) });
  } catch (error: any) {
    logger.error('Error uploading tests:', error);
    res.status(500).json({ error: error.message });
  }
});
