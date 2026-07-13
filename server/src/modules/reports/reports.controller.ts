import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { KnowledgeEngineService } from '../knowledge-engine/knowledgeEngine.service.js';
import { generateReportPDF } from '../../utils/pdfGenerator.js';
import { sendEmail } from '../../utils/mailer.js';
import { sendWhatsAppPDF } from '../../utils/whatsapp.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
export const reportsRouter = Router();
const mkeService = new KnowledgeEngineService();

// Generate sequential Report ID: REP-YYYYMMDD-XXXX
async function generateReportId(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const todayCount = await prisma.report.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  const sequentialNum = String(todayCount + 1).padStart(4, '0');
  return `REP-${dateStr}-${sequentialNum}`;
}

// Generate sequential Sample ID: SMP-YYYYMMDD-XXXX
async function generateSampleId(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const todayCount = await prisma.report.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  const sequentialNum = String(todayCount + 1).padStart(4, '0');
  return `SMP-${dateStr}-${sequentialNum}`;
}

// Generate sequential Visit ID: VIS-YYYYMMDD-XXXX
async function generateVisitId(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const todayCount = await prisma.visit.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  const sequentialNum = String(todayCount + 1).padStart(4, '0');
  return `VIS-${dateStr}-${sequentialNum}`;
}

// Create new report & load templates
reportsRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      patientId: z.string().min(1),
      doctorId: z.string().min(1),
      testIds: z.array(z.string()).min(1),
      visitId: z.string().optional(),
      remarks: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const { patientId, doctorId, testIds, visitId, remarks } = parsed.data;

    // Validate patient & doctor
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || patient.deletedAt) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor || !doctor.isActive) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Resolve or Auto-Create Visit
    let finalVisitId = visitId;
    if (!finalVisitId) {
      finalVisitId = await generateVisitId();
      await prisma.visit.create({
        data: {
          id: finalVisitId,
          patientId,
          doctorId,
          status: 'TESTING'
        }
      });
    } else {
      // Update existing Visit status to TESTING
      await prisma.visit.update({
        where: { id: finalVisitId },
        data: { status: 'TESTING' }
      });
    }

    const reportId = await generateReportId();
    const sampleId = await generateSampleId();

    // Create Report
    const report = await prisma.report.create({
      data: {
        id: reportId,
        visitId: finalVisitId,
        patientId,
        doctorId,
        sampleId,
        registrationDate: new Date(),
        status: 'PENDING',
        remarks
      }
    });

    // Resolve tests to retrieve default prices
    const tests = await prisma.test.findMany({
      where: { id: { in: testIds } },
      include: {
        testParameters: {
          include: {
            parameter: {
              include: {
                unit: true
              }
            }
          }
        }
      }
    });

    let totalOriginalPrice = 0;

    // Create Report-Test links with base prices
    for (const testId of testIds) {
      const matchingTest = tests.find(t => t.id === testId);
      const price = matchingTest?.defaultPrice || 0;
      totalOriginalPrice += price;

      await prisma.reportTest.create({
        data: {
          reportId,
          testId,
          defaultPrice: price,
          chargedPrice: price
        }
      });
    }

    // Initialize the default Billing summary record
    await prisma.billing.create({
      data: {
        reportId,
        originalPrice: totalOriginalPrice,
        discount: 0,
        discountPercent: 0,
        finalPrice: totalOriginalPrice,
        paidAmount: totalOriginalPrice,
        balance: 0,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH'
      }
    });

    // Keep unique list of parameter IDs to avoid duplicates if panels share tests
    const paramIdsProcessed = new Set<string>();

    for (const test of tests) {
      const sortedParams = test.testParameters.sort((a, b) => a.sortOrder - b.sortOrder);
      
      for (const tp of sortedParams) {
        if (paramIdsProcessed.has(tp.parameterId)) continue;
        paramIdsProcessed.add(tp.parameterId);

        const parameter = tp.parameter;
        
        // Query MKE to resolve Reference Range based on patient age & gender
        const resolvedRange = await mkeService.resolveReferenceRange(
          parameter.id,
          patient.age,
          patient.gender
        );

        const refText = resolvedRange ? resolvedRange.displayText : 'No default range';
        const unitText = parameter.unit?.name || '';

        await prisma.reportResult.create({
          data: {
            reportId,
            parameterId: parameter.id,
            value: '', // initially empty
            unitText,
            referenceRangeText: refText,
            isAbnormal: false
          }
        });
      }
    }

    // Generate initial PDF placeholder
    await generateReportPDF({ reportId });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE_REPORT',
        details: `Created report: ${reportId} for patient: ${patient.name}`
      }
    });

    res.status(201).json(report);
  } catch (error: any) {
    logger.error('Error creating report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save report results (manually entered values)
reportsRouter.put('/:id/results', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      status: z.enum(['DRAFT', 'PENDING', 'PENDING_VERIFICATION', 'VERIFIED', 'PRINTED', 'CANCELLED']).optional(),
      remarks: z.string().optional(),
      results: z.array(z.object({
        parameterId: z.string(),
        value: z.string(),
        unitText: z.string(),
        referenceRangeText: z.string(),
        remarks: z.string().optional()
      }))
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: { patient: true }
    });

    if (!report || report.deletedAt) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Freeze edit inputs on verified/printed reports
    if (report.status === 'VERIFIED' || report.status === 'PRINTED') {
      return res.status(403).json({ error: 'Cannot modify a verified or printed medical record.' });
    }

    const { status, remarks, results } = parsed.data;

    // Save results and automatically check abnormal levels
    for (const resItem of results) {
      const parameter = await prisma.parameter.findUnique({
        where: { id: resItem.parameterId },
        include: { referenceRanges: true }
      });

      let isAbnormal = false;
      
      if (parameter && resItem.value) {
        // Resolve range for comparison
        const resolvedRange = await mkeService.resolveReferenceRange(
          parameter.id,
          report.patient.age,
          report.patient.gender
        );

        if (resolvedRange) {
          const numVal = parseFloat(resItem.value);
          if (!isNaN(numVal)) {
            if (resolvedRange.minVal !== null && numVal < resolvedRange.minVal) {
              isAbnormal = true;
            }
            if (resolvedRange.maxVal !== null && numVal > resolvedRange.maxVal) {
              isAbnormal = true;
            }
          }
        }
      }

      // Upsert result row
      const existingResult = await prisma.reportResult.findFirst({
        where: { reportId: id, parameterId: resItem.parameterId }
      });

      if (existingResult) {
        await prisma.reportResult.update({
          where: { id: existingResult.id },
          data: {
            value: resItem.value,
            unitText: resItem.unitText,
            referenceRangeText: resItem.referenceRangeText,
            isAbnormal,
            remarks: resItem.remarks
          }
        });
      } else {
        await prisma.reportResult.create({
          data: {
            reportId: id,
            parameterId: resItem.parameterId,
            value: resItem.value,
            unitText: resItem.unitText,
            referenceRangeText: resItem.referenceRangeText,
            isAbnormal,
            remarks: resItem.remarks
          }
        });
      }
    }

    // Update Report top-level status
    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        status: status || report.status,
        remarks: remarks !== undefined ? remarks : report.remarks
      }
    });

    // Update parent Visit status dynamically
    if (updatedReport.visitId && status) {
      await prisma.visit.update({
        where: { id: updatedReport.visitId },
        data: { status: status }
      });
    }

    // Re-generate high-quality printable PDF
    await generateReportPDF({ reportId: id });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE_REPORT_RESULTS',
        details: `Saved results for report: ${id}. Status set to: ${status || report.status}`
      }
    });

    res.json(updatedReport);
  } catch (error: any) {
    logger.error('Error saving report results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch detailed report by ID
reportsRouter.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        reportTests: {
          include: {
            test: {
              include: {
                testParameters: {
                  include: {
                    parameter: true
                  }
                }
              }
            }
          }
        },
        results: {
          include: {
            parameter: {
              include: {
                unit: true
              }
            }
          }
        },
        deliveryHistory: true
      }
    });

    if (!report || report.deletedAt) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error: any) {
    logger.error('Error fetching report details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search & list reports
reportsRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      q,
      status,
      doctorId,
      startDate,
      endDate,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const whereClause: any = {
      deletedAt: null
    };

    if (status) {
      whereClause.status = status;
    }

    if (doctorId) {
      whereClause.doctorId = doctorId;
    }

    if (startDate || endDate) {
      whereClause.registrationDate = {};
      if (startDate) {
        whereClause.registrationDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.registrationDate.lte = new Date(endDate as string);
      }
    }

    // Search query q filters Patient Name, Patient Phone, Patient ID, Doctor Name, Report ID, Sample ID
    if (q) {
      const searchStr = (q as string).toLowerCase().trim();
      whereClause.OR = [
        { id: { contains: searchStr } },
        { sampleId: { contains: searchStr } },
        { patient: { name: { contains: searchStr } } },
        { patient: { phone: { contains: searchStr } } },
        { patient: { id: { contains: searchStr } } },
        { doctor: { name: { contains: searchStr } } }
      ];
    }

    const [reports, total] = await prisma.$transaction([
      prisma.report.findMany({
        where: whereClause,
        include: {
          patient: true,
          doctor: true,
          reportTests: {
            include: { test: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.report.count({ where: whereClause })
    ]);

    res.json({
      reports,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error: any) {
    logger.error('Error searching reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download/View PDF Report
reportsRouter.get('/download/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pdfPath = path.resolve(__dirname, '../../../../pdf', `${id}.pdf`);
    
    if (!fs.existsSync(pdfPath)) {
      // Regenerate if file missing
      await generateReportPDF({ reportId: id });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${id}.pdf"`);
    res.sendFile(pdfPath);
  } catch (error: any) {
    logger.error('Error downloading PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update Report status to Printed
reportsRouter.post('/:id/print', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.update({
      where: { id },
      data: { status: 'PRINTED' }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'PRINT_REPORT',
        details: `Printed report sheet: ${id}`
      }
    });

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Share report PDF via WhatsApp or Email
reportsRouter.post('/:id/share', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      channel: z.enum(['EMAIL', 'WHATSAPP']),
      recipient: z.string().min(1)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const { channel, recipient } = parsed.data;

    const report = await prisma.report.findUnique({
      where: { id },
      include: { patient: true }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const pdfPath = path.resolve(__dirname, '../../../../pdf', `${id}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      await generateReportPDF({ reportId: id });
    }

    let shareSuccess = false;
    let errorMsg: string | undefined;

    if (channel === 'EMAIL') {
      const emailRes = await sendEmail({
        to: recipient,
        subject: `Medical Pathology Lab Report - Patient ${report.patient.name} (${id})`,
        text: `Dear Patient,\n\nPlease find attached your laboratory pathology report (${id}).\n\nBest Regards,\nLaboratory Diagnostics System.`,
        html: `<p>Dear Patient,</p><p>Please find attached your laboratory pathology report (<b>${id}</b>).</p><br><p>Best Regards,</p><p>Laboratory Diagnostics System</p>`,
        attachments: [
          {
            filename: `${id}.pdf`,
            path: pdfPath
          }
        ],
        licenseId: req.user?.licenseId
      });
      shareSuccess = emailRes.success;
      errorMsg = emailRes.error;
    } else {
      const whatsappRes = await sendWhatsAppPDF({
        phone: recipient,
        pdfPath,
        pdfFilename: `${id}.pdf`,
        patientName: report.patient.name,
        reportId: id,
        licenseId: req.user?.licenseId
      });
      shareSuccess = whatsappRes.success;
      errorMsg = whatsappRes.error;
    }

    // Save Delivery History
    const log = await prisma.deliveryHistory.create({
      data: {
        reportId: id,
        recipient,
        channel,
        status: shareSuccess ? 'SENT' : 'FAILED',
        errorMessage: errorMsg
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: `SHARE_REPORT_${channel}`,
        details: `Shared report ${id} via ${channel} to ${recipient}. Result: ${log.status}`
      }
    });

    res.json({ success: shareSuccess, log });
  } catch (error: any) {
    logger.error('Error sharing report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard statistics
reportsRouter.get('/dashboard/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    // Today's registered patients count
    const todayPatientsCount = await prisma.patient.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        deletedAt: null
      }
    });

    // Report status counts
    const pendingReportsCount = await prisma.report.count({
      where: { status: 'PENDING', deletedAt: null }
    });

    const completedReportsCount = await prisma.report.count({
      where: { status: 'COMPLETED', deletedAt: null }
    });

    const printedReportsCount = await prisma.report.count({
      where: { status: 'PRINTED', deletedAt: null }
    });

    // Recent reports lists
    const recentReportsRaw = await prisma.report.findMany({
      where: { deletedAt: null },
      include: {
        patient: true,
        doctor: true,
        reportTests: {
          include: { test: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const recentReports = recentReportsRaw.map(r => ({
      id: r.id,
      patientName: r.patient.name,
      doctorName: r.doctor.name,
      testsText: r.reportTests.map(rt => rt.test.name).join(', '),
      status: r.status as any,
      createdAt: r.createdAt
    }));

    // Most frequently used tests
    const testCounts = await prisma.reportTest.groupBy({
      by: ['testId'],
      _count: {
        testId: true
      }
    });

    const allTests = await prisma.test.findMany({
      where: { deletedAt: null }
    });

    const mostUsedTests = testCounts
      .map(tc => {
        const test = allTests.find(t => t.id === tc.testId);
        return {
          testName: test ? test.name : 'Unknown Panel',
          count: tc._count.testId
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      todayPatientsCount,
      pendingReportsCount,
      completedReportsCount,
      printedReportsCount,
      recentReports,
      mostUsedTests
    });
  } catch (error: any) {
    logger.error('Error fetching dashboard statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete (soft delete) a patient report entry
reportsRouter.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.deletedAt) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Soft delete the report
    await prisma.report.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Patient entry deleted successfully.' });
  } catch (error: any) {
    logger.error('Error deleting report:', error);
    res.status(500).json({ error: error.message });
  }
});
