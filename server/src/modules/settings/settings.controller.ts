import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { z } from 'zod';
import path from 'path';
export const settingsRouter = Router();

// Retrieve global laboratory settings
settingsRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const laboratoryId = (req as AuthenticatedRequest).user?.laboratoryId || 'default-lab';
    const settingsRecord = await prisma.setting.findFirst({
      where: { key: 'lab_settings', laboratoryId }
    });

    if (!settingsRecord) {
      // Default settings template
      const defaults = {
        labName: 'Laboratory Report Management System',
        labAddress: '123 Diagnostic Road, Healthcare City',
        labPhone: '+1 (555) 0199',
        labEmail: 'info@labdiagnostics.com',
        labLogo: '',
        labFooter: 'This report is generated for medical diagnostic evaluation only.',
        doctorSignature: '',
        pdfThemeColor: '#0d9488', // Teal-600 default
        whatsappEnabled: false,
        whatsappApiKey: '',
        whatsappPhoneId: '',
        emailEnabled: false,
        emailSmtpHost: '',
        emailSmtpPort: 587,
        emailSmtpUser: '',
        emailSmtpPass: '',
        emailSender: '',
        geminiApiKey: ''
      };

      await prisma.setting.create({
        data: {
          key: 'lab_settings',
          laboratoryId,
          value: JSON.stringify(defaults)
        }
      });

      return res.json(defaults);
    }

    res.json(JSON.parse(settingsRecord.value));
  } catch (error: any) {
    logger.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update global laboratory settings
settingsRouter.put('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      labName: z.string().min(1).optional().nullable(),
      labAddress: z.string().optional().nullable(),
      labPhone: z.string().optional().nullable(),
      labEmail: z.string().email().or(z.literal('')).optional().nullable(),
      labLogo: z.string().optional().nullable(),
      labFooter: z.string().optional().nullable(),
      doctorSignature: z.string().optional().nullable(),
      pdfThemeColor: z.string().regex(/^#[0-9A-F]{6}$/i).or(z.literal('')).optional().nullable(),
      whatsappEnabled: z.boolean().optional().nullable(),
      whatsappApiKey: z.string().optional().nullable(),
      whatsappPhoneId: z.string().optional().nullable(),
      emailEnabled: z.boolean().optional().nullable(),
      emailSmtpHost: z.string().optional().nullable(),
      emailSmtpPort: z.number().int().nonnegative().optional().nullable(),
      emailSmtpUser: z.string().optional().nullable(),
      emailSmtpPass: z.string().optional().nullable(),
      emailSender: z.string().optional().nullable(),
      geminiApiKey: z.string().optional().nullable(),
      usePreprinted: z.boolean().optional().nullable(),
      topMargin: z.number().optional().nullable(),
      leftMargin: z.number().optional().nullable(),
      xName: z.number().optional().nullable(),
      yName: z.number().optional().nullable(),
      xDoctor: z.number().optional().nullable(),
      yDoctor: z.number().optional().nullable(),
      xSampleId: z.number().optional().nullable(),
      ySampleId: z.number().optional().nullable(),
      xAgeGender: z.number().optional().nullable(),
      yAgeGender: z.number().optional().nullable(),
      xRegDate: z.number().optional().nullable(),
      yRegDate: z.number().optional().nullable(),
      tableTopY: z.number().optional().nullable()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const laboratoryId = req.user?.laboratoryId || 'default-lab';
    const settingsValue = JSON.stringify(parsed.data);

    let updated;
    const existing = await prisma.setting.findFirst({ where: { key: 'lab_settings', laboratoryId } });
    if (existing) {
      updated = await prisma.setting.update({ where: { id: existing.id }, data: { value: settingsValue } });
    } else {
      updated = await prisma.setting.create({ data: { key: 'lab_settings', value: settingsValue, laboratoryId } });
    }

    await prisma.auditLog.create({
      data: {
        laboratoryId,
        userId: req.user?.id,
        action: 'UPDATE_LAB_SETTINGS',
        details: 'Updated global laboratory and integrations configurations'
      }
    });

    res.json(JSON.parse(updated.value));
  } catch (error: any) {
    logger.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Retrieve technician-specific settings
settingsRouter.get('/technician', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let settings = await prisma.technicianSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      settings = await prisma.technicianSettings.create({
        data: {
          userId,
          theme: 'light',
          language: 'en',
          printerName: '',
          paperSize: 'A4',
          margins: 'normal',
          defaultTemplate: '',
          notifications: '{}',
          shortcuts: '{}',
          dashboardLayout: 'default'
        }
      });
    }

    res.json(settings);
  } catch (error: any) {
    logger.error('Error fetching technician settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update technician-specific settings
settingsRouter.put('/technician', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      theme: z.string().optional(),
      language: z.string().optional(),
      printerName: z.string().optional(),
      paperSize: z.string().optional(),
      margins: z.string().optional(),
      defaultTemplate: z.string().optional(),
      signature: z.string().optional().nullable(),
      notifications: z.string().optional(),
      shortcuts: z.string().optional(),
      dashboardLayout: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const updated = await prisma.technicianSettings.upsert({
      where: { userId },
      update: parsed.data,
      create: {
        userId,
        theme: parsed.data.theme || 'light',
        language: parsed.data.language || 'en',
        printerName: parsed.data.printerName || '',
        paperSize: parsed.data.paperSize || 'A4',
        margins: parsed.data.margins || 'normal',
        defaultTemplate: parsed.data.defaultTemplate || '',
        signature: parsed.data.signature || null,
        notifications: parsed.data.notifications || '{}',
        shortcuts: parsed.data.shortcuts || '{}',
        dashboardLayout: parsed.data.dashboardLayout || 'default'
      }
    });

    res.json(updated);
  } catch (error: any) {
    logger.error('Error updating technician settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test connection to Gemini API key
settingsRouter.post('/test-gemini', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API Key is required to test connection.' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello, respond with exactly "OK" if you can hear me.' }] }]
        })
      }
    );

    if (response.ok) {
      return res.json({ success: true, message: 'Connection Successful' });
    } else {
      let errorMsg = 'Unknown Gemini API error';
      try {
        const errJson = await response.json() as any;
        errorMsg = errJson.error?.message || errorMsg;
      } catch (e) {}
      return res.status(400).json({ error: errorMsg });
    }
  } catch (error: any) {
    logger.error('Error testing Gemini API connection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit logs
settingsRouter.get('/logs', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const laboratoryId = (req as AuthenticatedRequest).user?.laboratoryId || 'default-lab';
    const logs = await prisma.auditLog.findMany({
      where: { laboratoryId },
      include: {
        user: {
          select: { username: true, name: true }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 200
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all analyzer profiles
settingsRouter.get('/analyzers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const laboratoryId = (req as AuthenticatedRequest).user?.laboratoryId || 'default-lab';
    const profiles = await prisma.analyzerProfile.findMany({
      where: { laboratoryId },
      orderBy: { name: 'asc' }
    });
    res.json(profiles);
  } catch (error: any) {
    logger.error('Error fetching analyzer profiles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new analyzer profile
settingsRouter.post('/analyzers', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      model: z.string().min(1),
      connectionType: z.enum(['SERIAL', 'TCP', 'FILE']),
      config: z.string().default('[]')
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const laboratoryId = req.user?.laboratoryId || 'default-lab';
    const profile = await prisma.analyzerProfile.create({
      data: { ...parsed.data, laboratoryId }
    });

    await prisma.auditLog.create({
      data: {
        laboratoryId,
        userId: req.user?.id,
        action: 'CREATE_ANALYZER_PROFILE',
        details: `Created analyzer profile: ${profile.name} (${profile.model})`
      }
    });

    res.status(201).json(profile);
  } catch (error: any) {
    logger.error('Error creating analyzer profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update analyzer profile
settingsRouter.put('/analyzers/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().optional(),
      model: z.string().optional(),
      connectionType: z.enum(['SERIAL', 'TCP', 'FILE']).optional(),
      config: z.string().optional(),
      isActive: z.boolean().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const laboratoryId = req.user?.laboratoryId || 'default-lab';
    const existing = await prisma.analyzerProfile.findFirst({ where: { id, laboratoryId } });
    if (!existing) {
      return res.status(404).json({ error: 'Analyzer profile not found' });
    }

    const profile = await prisma.analyzerProfile.update({
      where: { id },
      data: parsed.data
    });

    await prisma.auditLog.create({
      data: {
        laboratoryId,
        userId: req.user?.id,
        action: 'UPDATE_ANALYZER_PROFILE',
        details: `Updated analyzer profile: ${profile.name}`
      }
    });

    res.json(profile);
  } catch (error: any) {
    logger.error('Error updating analyzer profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete analyzer profile
settingsRouter.delete('/analyzers/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const laboratoryId = req.user?.laboratoryId || 'default-lab';
    const { id } = req.params;
    const existing = await prisma.analyzerProfile.findFirst({ where: { id, laboratoryId } });
    if (!existing) {
      return res.status(404).json({ error: 'Analyzer profile not found' });
    }

    await prisma.analyzerProfile.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        laboratoryId,
        userId: req.user?.id,
        action: 'DELETE_ANALYZER_PROFILE',
        details: `Deleted analyzer profile ID: ${id}`
      }
    });

    res.json({ success: true, message: 'Analyzer profile deleted.' });
  } catch (error: any) {
    logger.error('Error deleting analyzer profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger database SQL file backup copy
settingsRouter.post('/backup/db', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { copyFileSync, existsSync, mkdirSync, statSync } = await import('fs');
    const path = await import('path');
    const dbPath = path.resolve(__dirname, '../../../../prisma/lrms.db');
    const backupsDir = path.resolve(__dirname, '../../../../backups');
    
    if (!existsSync(dbPath)) {
      return res.status(400).json({ error: `Database file not found at ${dbPath}` });
    }

    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `lrms_backup_${timestamp}.db`;
    const backupPath = path.join(backupsDir, backupFile);

    copyFileSync(dbPath, backupPath);
    const stats = statSync(backupPath);

    const laboratoryId = (req as any).user?.laboratoryId || 'default-lab';
    await prisma.auditLog.create({
      data: {
        laboratoryId,
        userId: (req as any).user?.id,
        action: 'BACKUP_SQL_DATABASE',
        details: `Created database binary SQL backup copy: ${backupFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
      }
    });

    res.json({
      success: true,
      filename: backupFile,
      sizeBytes: stats.size,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Error copying database backup file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export entire DB as structured JSON data
settingsRouter.get('/backup/export', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const laboratoryId = (req as AuthenticatedRequest).user?.laboratoryId || 'default-lab';
    const patients = await prisma.patient.findMany({ where: { laboratoryId } });
    const doctors = await prisma.doctor.findMany({ where: { laboratoryId } });
    const parameters = await prisma.parameter.findMany({ where: { laboratoryId }, include: { referenceRanges: true } });
    const tests = await prisma.test.findMany({ where: { laboratoryId }, include: { testParameters: true } });
    const reports = await prisma.report.findMany({ where: { laboratoryId }, include: { reportTests: true, results: true } });
    const settings = await prisma.setting.findMany({ where: { laboratoryId } });
    const users = await prisma.user.findMany({ select: { id: true, username: true, name: true, role: true, isActive: true } });

    const exportPayload = {
      version: '1.0.0',
      exportedAt: new Date(),
      data: {
        patients,
        doctors,
        parameters,
        tests,
        reports,
        settings,
        users
      }
    };

    res.json(exportPayload);
  } catch (error: any) {
    logger.error('Error exporting database JSON:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import entire DB from structured JSON data
settingsRouter.post('/backup/import', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Import payload missing "data" property.' });
    }

    const { patients = [], doctors = [], parameters = [], tests = [], reports = [], settings = [] } = data;

    // Use Prisma transaction to restore data cleanly
    await prisma.$transaction(async (tx) => {
      // 1. Settings
      const laboratoryId = (req as any).user?.laboratoryId || 'default-lab';
      for (const s of settings) {
        await tx.setting.upsert({
          where: { 
            key_laboratoryId: {
              key: s.key,
              laboratoryId
            }
          },
          update: { value: s.value },
          create: { key: s.key, value: s.value, laboratoryId }
        });
      }

      // 2. Doctors
      for (const d of doctors) {
        await tx.doctor.upsert({
          where: { id: d.id },
          update: { name: d.name, qualification: d.qualification, hospital: d.hospital, registrationNumber: d.registrationNumber, phone: d.phone, isActive: d.isActive },
          create: d
        });
      }

      // 3. Patients
      for (const p of patients) {
        await tx.patient.upsert({
          where: { id: p.id },
          update: { name: p.name, age: p.age, ageUnit: p.ageUnit, gender: p.gender, phone: p.phone, remarks: p.remarks },
          create: p
        });
      }

      // 4. Parameters & Ranges
      for (const p of parameters) {
        const { referenceRanges = [], ...paramFields } = p;
        await tx.parameter.upsert({
          where: { id: p.id },
          update: { name: p.name, shortCode: p.shortCode, category: p.category, unitId: p.unitId, decimalPrecision: p.decimalPrecision, description: p.description, isActive: p.isActive },
          create: paramFields
        });

        for (const r of referenceRanges) {
          await tx.referenceRange.upsert({
            where: { id: r.id },
            update: { gender: r.gender, ageMin: r.ageMin, ageMax: r.ageMax, minVal: r.minVal, maxVal: r.maxVal, displayText: r.displayText, condition: r.condition },
            create: r
          });
        }
      }

      // 5. Tests & TestParameters
      for (const t of tests) {
        const { testParameters = [], ...testFields } = t;
        await tx.test.upsert({
          where: { id: t.id },
          update: { name: t.name, shortCode: t.shortCode, category: t.category, isActive: t.isActive },
          create: testFields
        });

        for (const tp of testParameters) {
          await tx.testParameter.upsert({
            where: { testId_parameterId: { testId: tp.testId, parameterId: tp.parameterId } },
            update: { sortOrder: tp.sortOrder },
            create: { testId: tp.testId, parameterId: tp.parameterId, sortOrder: tp.sortOrder }
          });
        }
      }

      // 6. Reports & Results
      for (const r of reports) {
        const { results = [], reportTests = [], ...reportFields } = r;
        await tx.report.upsert({
          where: { id: r.id },
          update: { visitId: r.visitId, patientId: r.patientId, doctorId: r.doctorId, sampleId: r.sampleId, registrationDate: new Date(r.registrationDate), status: r.status, remarks: r.remarks },
          create: { ...reportFields, registrationDate: new Date(r.registrationDate) }
        });

        for (const rt of reportTests) {
          await tx.reportTest.upsert({
            where: { reportId_testId: { reportId: rt.reportId, testId: rt.testId } },
            update: {},
            create: { reportId: rt.reportId, testId: rt.testId }
          });
        }

        for (const resItem of results) {
          await tx.reportResult.upsert({
            where: { id: resItem.id },
            update: { value: resItem.value, unitText: resItem.unitText, referenceRangeText: resItem.referenceRangeText, isAbnormal: resItem.isAbnormal, remarks: resItem.remarks },
            create: { id: resItem.id, reportId: resItem.reportId, parameterId: resItem.parameterId, value: resItem.value, unitText: resItem.unitText, referenceRangeText: resItem.referenceRangeText, isAbnormal: resItem.isAbnormal, remarks: resItem.remarks }
          });
        }
      }
    });

    const laboratoryId = req.user?.laboratoryId || 'default-lab';
    await prisma.auditLog.create({
      data: {
        laboratoryId,
        userId: req.user?.id,
        action: 'IMPORT_JSON_BACKUP',
        details: 'Successfully imported global configurations and records from JSON schema file.'
      }
    });

    res.json({ success: true, message: 'JSON database schema restore completed successfully.' });
  } catch (error: any) {
    logger.error('Error importing database JSON:', error);
    res.status(500).json({ error: error.message });
  }
});
