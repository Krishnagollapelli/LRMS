import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { z } from 'zod';

export const doctorsRouter = Router();

// Get all active doctors
doctorsRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json(doctors);
  } catch (error: any) {
    logger.error('Error fetching doctors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new doctor
doctorsRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      qualification: z.string().min(1),
      hospital: z.string().min(1),
      registrationNumber: z.string().min(1),
      phone: z.string().min(1)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const newDoctor = await prisma.doctor.create({
      data: parsed.data
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE_DOCTOR',
        details: `Created doctor: ${newDoctor.name} (${newDoctor.registrationNumber})`
      }
    });

    res.status(201).json(newDoctor);
  } catch (error: any) {
    logger.error('Error creating doctor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update doctor
doctorsRouter.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().optional(),
      qualification: z.string().optional(),
      hospital: z.string().optional(),
      registrationNumber: z.string().optional(),
      phone: z.string().optional(),
      isActive: z.boolean().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const updatedDoctor = await prisma.doctor.update({
      where: { id },
      data: parsed.data
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE_DOCTOR',
        details: `Updated doctor: ${doctor.name}`
      }
    });

    res.json(updatedDoctor);
  } catch (error: any) {
    logger.error('Error updating doctor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Soft Delete doctor
doctorsRouter.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    await prisma.doctor.update({
      where: { id },
      data: { isActive: false }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'DELETE_DOCTOR',
        details: `Deleted doctor: ${doctor.name}`
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting doctor:', error);
    res.status(500).json({ error: error.message });
  }
});
