import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sendEmail } from '../../utils/mailer.js';
import { sendWhatsAppPDF } from '../../utils/whatsapp.js';
import { embedBase64Image } from '../../utils/pdfGenerator.js';
import path from 'path';
import fs from 'fs';
export const billingRouter = Router();

// Helper to generate invoice PDF byte buffer
async function generateReceiptBuffer(reportId: string): Promise<Buffer> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      patient: true,
      doctor: true,
      billing: true,
      reportTests: {
        include: {
          test: true
        }
      }
    }
  });

  if (!report) {
    throw new Error('Report not found');
  }

  // Load Settings
  const settingsRecord = await prisma.setting.findUnique({ where: { key: 'lab_settings' } });
  let labSettings: any = {
    labName: 'Diagnostic Laboratory System',
    labAddress: '123 Medical Health Street, Health City',
    labPhone: '+1 (555) 0199',
    labEmail: 'reports@diagnosticlab.com',
    pdfThemeColor: '#0d9488'
  };
  if (settingsRecord) {
    try {
      labSettings = { ...labSettings, ...JSON.parse(settingsRecord.value) };
    } catch (e) {}
  }

  const billing = report.billing || {
    originalPrice: report.reportTests.reduce((acc, rt) => acc + (rt.defaultPrice || 0), 0),
    discount: 0,
    discountPercent: 0,
    finalPrice: report.reportTests.reduce((acc, rt) => acc + (rt.chargedPrice || 0), 0),
    paidAmount: report.reportTests.reduce((acc, rt) => acc + (rt.chargedPrice || 0), 0),
    balance: 0,
    paymentStatus: 'PAID',
    paymentMethod: 'CASH'
  };

  // Draw PDF
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed logo image if available
  let logoImage: any = null;
  if (labSettings.labLogo) {
    try {
      logoImage = await embedBase64Image(pdfDoc, labSettings.labLogo);
    } catch (e) {
      logger.error('Failed to embed lab logo image in billing receipt PDF:', e);
    }
  }

  const themeColorHex = labSettings.pdfThemeColor || '#0d9488';
  const rVal = parseInt(themeColorHex.slice(1, 3), 16) / 255;
  const gVal = parseInt(themeColorHex.slice(3, 5), 16) / 255;
  const bVal = parseInt(themeColorHex.slice(5, 7), 16) / 255;
  const themeColor = rgb(rVal, gVal, bVal);
  const textColor = rgb(0.1, 0.1, 0.1);
  const secondaryColor = rgb(0.4, 0.4, 0.4);

  const page = pdfDoc.addPage([420, 595]); // A5 size: 420 x 595 points
  const width = 420;
  const height = 595;

  // Draw base64 logo if loaded
  if (logoImage) {
    try {
      page.drawImage(logoImage, {
        x: 30,
        y: height - 80,
        width: 35,
        height: 35
      });
    } catch (e) {
      logger.error('Failed to draw lab logo image in billing receipt PDF:', e);
    }
  }

  const headerTextX = logoImage ? 75 : 30;

  // Header
  page.drawText(labSettings.labName, { x: headerTextX, y: height - 50, size: 12, font: fontBold, color: themeColor });
  page.drawText(labSettings.labAddress, { x: headerTextX, y: height - 65, size: 7.5, font: fontRegular, color: secondaryColor });
  page.drawText(`Phone: ${labSettings.labPhone}`, { x: headerTextX, y: height - 76, size: 7.5, font: fontRegular, color: secondaryColor });

  page.drawText('INVOICE / RECEIPT', { x: width - 135, y: height - 50, size: 10, font: fontBold, color: textColor });
  page.drawText(`Visit Number: ${report.visitId || report.id}`, { x: width - 135, y: height - 63, size: 7.5, font: fontRegular, color: secondaryColor });
  page.drawText(`Date: ${new Date(report.registrationDate).toLocaleDateString()}`, { x: width - 135, y: height - 74, size: 7.5, font: fontRegular, color: secondaryColor });

  page.drawLine({ start: { x: 30, y: height - 85 }, end: { x: width - 30, y: height - 85 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

  // Patient info block
  page.drawText(`Patient: ${report.patient.name}`, { x: 30, y: height - 102, size: 8.5, font: fontBold, color: textColor });
  const ageStr = report.patient.age ? `${report.patient.age} ${(report.patient.ageUnit || 'YEARS').toLowerCase()}` : 'N/A';
  page.drawText(`Age/Gender: ${ageStr} / ${report.patient.gender || 'N/A'}`, { x: 30, y: height - 113, size: 7.5, font: fontRegular, color: secondaryColor });
  page.drawText(`Doctor: ${report.doctor.name}`, { x: 30, y: height - 124, size: 7.5, font: fontRegular, color: secondaryColor });

  page.drawLine({ start: { x: 30, y: height - 134 }, end: { x: width - 30, y: height - 134 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

  // Table of investigations
  page.drawText('Investigation Name', { x: 35, y: height - 150, size: 8, font: fontBold, color: textColor });
  page.drawText('Default Price', { x: width - 165, y: height - 150, size: 8, font: fontBold, color: textColor });
  page.drawText('Charged Price', { x: width - 90, y: height - 150, size: 8, font: fontBold, color: textColor });

  let yOffset = height - 168;
  report.reportTests.forEach((rt, idx) => {
    const def = rt.defaultPrice || rt.test.defaultPrice || 0;
    const chg = rt.chargedPrice || def;
    
    page.drawText(`${idx + 1}. ${rt.test.name}`, { x: 35, y: yOffset, size: 7.5, font: fontRegular, color: textColor });
    page.drawText(`INR ${def.toFixed(2)}`, { x: width - 165, y: yOffset, size: 7.5, font: fontRegular, color: textColor });
    page.drawText(`INR ${chg.toFixed(2)}`, { x: width - 90, y: yOffset, size: 7.5, font: fontRegular, color: textColor });
    yOffset -= 15;
  });

  page.drawLine({ start: { x: 30, y: yOffset - 3 }, end: { x: width - 30, y: yOffset - 3 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

  // Totals Block
  yOffset -= 20;
  page.drawText(`Total Default Amount:`, { x: width - 180, y: yOffset, size: 7.5, font: fontRegular, color: secondaryColor });
  page.drawText(`INR ${billing.originalPrice.toFixed(2)}`, { x: width - 90, y: yOffset, size: 7.5, font: fontRegular, color: textColor });

  yOffset -= 14;
  page.drawText(`Total Charged Amount:`, { x: width - 180, y: yOffset, size: 7.5, font: fontRegular, color: secondaryColor });
  page.drawText(`INR ${billing.finalPrice.toFixed(2)}`, { x: width - 90, y: yOffset, size: 7.5, font: fontRegular, color: textColor });

  yOffset -= 14;
  page.drawText(`Net Payable:`, { x: width - 180, y: yOffset, size: 7.5, font: fontBold, color: textColor });
  page.drawText(`INR ${billing.finalPrice.toFixed(2)}`, { x: width - 90, y: yOffset, size: 7.5, font: fontBold, color: themeColor });

  yOffset -= 14;
  page.drawText(`Paid Amount:`, { x: width - 180, y: yOffset, size: 7.5, font: fontRegular, color: secondaryColor });
  page.drawText(`INR ${billing.paidAmount.toFixed(2)}`, { x: width - 90, y: yOffset, size: 7.5, font: fontRegular, color: textColor });

  yOffset -= 14;
  page.drawText(`Balance Due:`, { x: width - 180, y: yOffset, size: 7.5, font: fontRegular, color: secondaryColor });
  page.drawText(`INR ${billing.balance.toFixed(2)}`, { x: width - 90, y: yOffset, size: 7.5, font: fontRegular, color: textColor });

  // Payment Info stamps
  yOffset -= 28;
  page.drawRectangle({
    x: 35,
    y: yOffset - 5,
    width: 120,
    height: 25,
    color: billing.paymentStatus === 'PAID' ? rgb(0.92, 0.97, 0.95) : rgb(0.99, 0.93, 0.93),
    borderColor: billing.paymentStatus === 'PAID' ? rgb(0.6, 0.8, 0.7) : rgb(0.9, 0.7, 0.7),
    borderWidth: 0.5
  });

  const statusText = `STATUS: ${billing.paymentStatus} (${billing.paymentMethod})`;
  page.drawText(statusText, { x: 42, y: yOffset + 5, size: 7, font: fontBold, color: billing.paymentStatus === 'PAID' ? rgb(0.1, 0.5, 0.3) : rgb(0.7, 0.2, 0.2) });

  // Sign Line
  page.drawText('Authorized Signature', { x: width - 120, y: yOffset - 10, size: 7, font: fontRegular, color: secondaryColor });
  page.drawLine({ start: { x: width - 125, y: yOffset }, end: { x: width - 35, y: yOffset }, thickness: 0.5, color: secondaryColor });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// Fetch billing details for a report (includes billing record and individual test prices)
billingRouter.get('/:reportId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        patient: true,
        doctor: true,
        billing: true,
        reportTests: {
          include: {
            test: true
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Sum up test base prices to initialize defaults if billing is missing
    const defaultOriginalPrice = report.reportTests.reduce((acc, rt) => acc + (rt.defaultPrice || rt.test.defaultPrice || 0), 0);
    const defaultChargedPrice = report.reportTests.reduce((acc, rt) => acc + (rt.chargedPrice || rt.defaultPrice || rt.test.defaultPrice || 0), 0);
    const defaultDiscount = defaultOriginalPrice - defaultChargedPrice;
    const defaultDiscountPercent = defaultOriginalPrice > 0 ? (defaultDiscount / defaultOriginalPrice) * 100 : 0;

    let billing = report.billing;
    if (!billing) {
      billing = await prisma.billing.create({
        data: {
          reportId,
          originalPrice: defaultOriginalPrice,
          discount: defaultDiscount,
          discountPercent: Number(defaultDiscountPercent.toFixed(2)),
          finalPrice: defaultChargedPrice,
          paidAmount: defaultChargedPrice,
          balance: 0,
          paymentStatus: 'PAID',
          paymentMethod: 'CASH'
        }
      });
    }

    const testDetails = report.reportTests.map(rt => ({
      testId: rt.testId,
      name: rt.test.name,
      defaultPrice: rt.defaultPrice || rt.test.defaultPrice || 0,
      chargedPrice: rt.chargedPrice || rt.defaultPrice || rt.test.defaultPrice || 0
    }));

    res.json({
      billing,
      patient: report.patient,
      doctor: report.doctor,
      tests: testDetails
    });
  } catch (error: any) {
    logger.error('Error fetching billing details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update billing details & recalculate discounts/totals automatically
billingRouter.post('/:reportId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { tests, paidAmount = 0, paymentMethod = 'CASH' } = req.body;

    // 1. Update individual test charged prices in ReportTest table if provided
    if (tests && Array.isArray(tests)) {
      for (const t of tests) {
        await prisma.reportTest.updateMany({
          where: { reportId, testId: t.testId },
          data: {
            chargedPrice: Number(t.chargedPrice)
          }
        });
      }
    }

    // 2. Fetch updated ReportTest records to run totals
    const reportTests = await prisma.reportTest.findMany({
      where: { reportId }
    });

    const originalPrice = reportTests.reduce((sum, rt) => sum + (rt.defaultPrice || 0), 0);
    const finalPrice = reportTests.reduce((sum, rt) => sum + (rt.chargedPrice || 0), 0);
    const discount = originalPrice - finalPrice;
    const discountPercent = originalPrice > 0 ? (discount / originalPrice) * 100 : 0;
    const balance = finalPrice - Number(paidAmount);
    
    let paymentStatus = 'UNPAID';
    if (balance <= 0) {
      paymentStatus = 'PAID';
    } else if (Number(paidAmount) > 0) {
      paymentStatus = 'PARTIAL';
    }

    // 3. Upsert Billing summary record
    const billing = await prisma.billing.upsert({
      where: { reportId },
      update: {
        originalPrice,
        discount,
        discountPercent: Number(discountPercent.toFixed(2)),
        finalPrice,
        paidAmount: Number(paidAmount),
        balance: Math.max(0, balance),
        paymentStatus,
        paymentMethod
      },
      create: {
        reportId,
        originalPrice,
        discount,
        discountPercent: Number(discountPercent.toFixed(2)),
        finalPrice,
        paidAmount: Number(paidAmount),
        balance: Math.max(0, balance),
        paymentStatus,
        paymentMethod
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'UPDATE_BILLING',
        details: `Updated billing for report ${reportId}: Original ${originalPrice}, Charged ${finalPrice}, Status ${paymentStatus}`
      }
    });

    // 4. Return updated structure
    res.json({
      billing,
      tests: reportTests
    });
  } catch (error: any) {
    logger.error('Error updating billing details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download/View Billing Receipt PDF (A5 Format)
billingRouter.get('/receipt/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const buffer = await generateReceiptBuffer(reportId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt_${reportId}.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    logger.error('Error serving receipt PDF:', error);
    res.status(500).send('Error serving invoice receipt: ' + error.message);
  }
});

// Share Billing Receipt PDF via WhatsApp or Email
billingRouter.post('/:reportId/share', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const { channel, recipient } = req.body; // 'WHATSAPP' | 'EMAIL'

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { patient: true }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Compile PDF
    const buffer = await generateReceiptBuffer(reportId);
    
    // Write receipt to disk temporarily (relative to workspace root)
    const dir = path.resolve(__dirname, '../../../../pdf');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const pdfPath = path.join(dir, `receipt_${reportId}.pdf`);
    fs.writeFileSync(pdfPath, buffer);

    let shareSuccess = false;
    let errorMsg: string | undefined;

    if (channel === 'EMAIL') {
      const emailRes = await sendEmail({
        to: recipient,
        subject: `Payment Invoice/Receipt - Patient ${report.patient.name} (${reportId})`,
        text: `Dear Patient,\n\nPlease find attached your laboratory payment invoice receipt (${reportId}).\n\nBest Regards,\nLaboratory Diagnostics System.`,
        html: `<p>Dear Patient,</p><p>Please find attached your laboratory payment invoice receipt (<b>${reportId}</b>).</p><br><p>Best Regards,</p><p>Laboratory Diagnostics System</p>`,
        attachments: [
          {
            filename: `receipt_${reportId}.pdf`,
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
        pdfFilename: `receipt_${reportId}.pdf`,
        patientName: report.patient.name,
        reportId,
        licenseId: req.user?.licenseId
      });
      shareSuccess = whatsappRes.success;
      errorMsg = whatsappRes.error;
    }

    // Save Delivery History
    await prisma.deliveryHistory.create({
      data: {
        reportId,
        recipient,
        channel,
        status: shareSuccess ? 'SENT' : 'FAILED',
        errorMessage: errorMsg
      }
    });

    if (!shareSuccess) {
      return res.status(500).json({ error: errorMsg || 'Failed to dispatch receipt sharing' });
    }

    res.json({ success: true, message: `Receipt successfully sent via ${channel}` });
  } catch (error: any) {
    logger.error('Error sharing receipt:', error);
    res.status(500).json({ error: error.message });
  }
});
