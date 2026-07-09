import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { z } from 'zod';
import Fuse from 'fuse.js';

export const patientsRouter = Router();

// Generate sequential Patient ID: PAT-YYYYMMDD-XXXX
async function generatePatientId(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const todayCount = await prisma.patient.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  const sequentialNum = String(todayCount + 1).padStart(4, '0');
  return `PAT-${dateStr}-${sequentialNum}`;
}

// Search patients using Fuzzy search
patientsRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';

    // Load active patients
    const patients = await prisma.patient.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });

    if (!q.trim()) {
      return res.json(patients.slice(0, 50)); // Return recent 50 patients
    }

    // Index with Fuse.js for fuzzy autocomplete
    const fuse = new Fuse(patients, {
      keys: ['id', 'name', 'phone'],
      threshold: 0.4
    });

    const results = fuse.search(q).map(r => r.item);
    res.json(results);
  } catch (error: any) {
    logger.error('Error searching patients:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get patient by ID
patientsRouter.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        reports: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!patient || patient.deletedAt) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error: any) {
    logger.error('Error fetching patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register new patient
patientsRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive().nullable().optional(),
      ageUnit: z.enum(['YEARS', 'MONTHS', 'DAYS']).nullable().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
      phone: z.string().nullable().optional(),
      remarks: z.string().optional().nullable()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const patientId = await generatePatientId();

    const newPatient = await prisma.patient.create({
      data: {
        id: patientId,
        ...parsed.data
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'REGISTER_PATIENT',
        details: `Registered patient: ${newPatient.name} (${newPatient.id})`
      }
    });

    res.status(201).json(newPatient);
  } catch (error: any) {
    logger.error('Error registering patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update patient details
patientsRouter.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().optional(),
      age: z.number().int().positive().nullable().optional(),
      ageUnit: z.enum(['YEARS', 'MONTHS', 'DAYS']).nullable().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
      phone: z.string().nullable().optional(),
      remarks: z.string().optional().nullable()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient || patient.deletedAt) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: parsed.data
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE_PATIENT',
        details: `Updated patient details: ${patient.name} (${patient.id})`
      }
    });

    res.json(updatedPatient);
  } catch (error: any) {
    logger.error('Error updating patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// Soft Delete patient
patientsRouter.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient || patient.deletedAt) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'DELETE_PATIENT',
        details: `Deleted patient: ${patient.name} (${patient.id})`
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting patient:', error);
    res.status(500).json({ error: error.message });
  }
});
