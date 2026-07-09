import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';
import { prisma } from './db.js';

export interface GeneratePdfParams {
  reportId: string;
}

export async function generateReportPDF(params: GeneratePdfParams): Promise<string> {
  try {
    // 1. Fetch complete report details from database
    const report = await prisma.report.findUnique({
      where: { id: params.reportId },
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
            parameter: true
          }
        }
      }
    });

    if (!report) {
      throw new Error(`Report ${params.reportId} not found in database.`);
    }

    // 2. Fetch Lab Settings
    const settingsRecord = await prisma.setting.findUnique({
      where: { key: 'lab_settings' }
    });

    let labSettings: any = {
      labName: 'Diagnostic Laboratory System',
      labAddress: '123 Medical Health Street, Health City',
      labPhone: '+1 (555) 0199',
      labEmail: 'reports@diagnosticlab.com',
      pdfThemeColor: '#0d9488', // Teal-600 default
      labFooter: 'This report is computer generated and requires no physical signature.'
    };

    if (settingsRecord) {
      try {
        const parsedSettings = JSON.parse(settingsRecord.value);
        labSettings = { ...labSettings, ...parsedSettings };
      } catch (e) {}
    }

    // 3. Create PDF Doc
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed logo and signature images if available
    let logoImage: any = null;
    if (labSettings.labLogo && !labSettings.usePreprinted) {
      try {
        logoImage = await embedBase64Image(pdfDoc, labSettings.labLogo);
      } catch (e) {
        logger.error('Failed to embed lab logo image in PDF:', e);
      }
    }

    let sigImage: any = null;
    if (labSettings.doctorSignature) {
      try {
        sigImage = await embedBase64Image(pdfDoc, labSettings.doctorSignature);
      } catch (e) {
        logger.error('Failed to embed doctor signature image in PDF:', e);
      }
    }

    // Color Helpers
    const themeColorHex = labSettings.pdfThemeColor || '#0d9488';
    const r = parseInt(themeColorHex.slice(1, 3), 16) / 255;
    const g = parseInt(themeColorHex.slice(3, 5), 16) / 255;
    const b = parseInt(themeColorHex.slice(5, 7), 16) / 255;
    const themeColor = rgb(r, g, b);
    const textColor = rgb(0.1, 0.1, 0.1);
    const secondaryColor = rgb(0.4, 0.4, 0.4);
    const lineGray = rgb(0.85, 0.85, 0.85);

    let page = pdfDoc.addPage([595.28, 841.89]); // A4 Size: 595.28 x 841.89 points
    const width = 595.28;
    const height = 841.89;
    let y = height - 40;

    // Helper: Header drawing
    const drawPageHeader = () => {
      if (labSettings.usePreprinted) return; // Skip completely!

      // Background Accent bar
      page.drawRectangle({
        x: 40,
        y: height - 50,
        width: width - 80,
        height: 6,
        color: themeColor
      });

      // Draw base64 logo if loaded
      if (logoImage) {
        try {
          page.drawImage(logoImage, {
            x: 40,
            y: height - 110,
            width: 50,
            height: 50
          });
        } catch (e) {
          logger.error('Failed to draw lab logo image in PDF:', e);
        }
      }

      const headerTextX = logoImage ? 105 : 40;

      // Lab Name
      page.drawText(labSettings.labName, {
        x: headerTextX,
        y: height - 80,
        size: 20,
        font: fontBold,
        color: themeColor
      });

      // Lab Details
      page.drawText(labSettings.labAddress, {
        x: headerTextX,
        y: height - 95,
        size: 9,
        font: fontRegular,
        color: secondaryColor
      });

      page.drawText(`Phone: ${labSettings.labPhone}  |  Email: ${labSettings.labEmail}`, {
        x: headerTextX,
        y: height - 110,
        size: 9,
        font: fontRegular,
        color: secondaryColor
      });

      // Divider Line
      page.drawLine({
        start: { x: 40, y: height - 120 },
        end: { x: width - 40, y: height - 120 },
        thickness: 1,
        color: lineGray
      });
    };

    // Helper: Patient Grid
    const drawPatientGrid = () => {
      const topY = height - (labSettings.topMargin || 135);
      
      if (!labSettings.usePreprinted) {
        // Patient Box background
        page.drawRectangle({
          x: 40,
          y: topY - 65,
          width: width - 80,
          height: 65,
          color: rgb(0.97, 0.98, 0.98),
          borderColor: lineGray,
          borderWidth: 0.5
        });
      }

      // Left Column
      // Patient ID (Only print if not preprinted)
      if (!labSettings.usePreprinted) {
        page.drawText(`Patient ID:`, { x: 50, y: topY - 15, size: 9, font: fontBold, color: textColor });
        page.drawText(report.patient.id, { x: 120, y: topY - 15, size: 9, font: fontRegular, color: textColor });
      }

      // Patient Name
      if (report.patient.name) {
        const xNameLabel = labSettings.usePreprinted ? (labSettings.xNameLabel || 40) : 50;
        const yName = labSettings.usePreprinted ? (labSettings.yName || 30) : 30;
        page.drawText(labSettings.usePreprinted ? `Name:` : `Patient Name:`, { 
          x: xNameLabel, 
          y: topY - yName, 
          size: 9, 
          font: fontBold, 
          color: textColor 
        });
        page.drawText(report.patient.name, { 
          x: labSettings.usePreprinted ? (labSettings.xName || 110) : 120, 
          y: topY - yName, 
          size: 9, 
          font: fontRegular, 
          color: textColor 
        });
      }

      // Ref. Doctor (Do not print if empty or direct reference)
      const hasDoctor = report.doctor && report.doctor.name && !['direct', 'self', 'none', 'direct reference', ''].includes(report.doctor.name.toLowerCase().trim());
      if (hasDoctor) {
        const xDoctorLabel = labSettings.usePreprinted ? (labSettings.xDoctorLabel || 40) : 50;
        const yDoctor = labSettings.usePreprinted ? (labSettings.yDoctor || 45) : 45;
        page.drawText(labSettings.usePreprinted ? `Doctor:` : `Ref. Doctor:`, { 
          x: xDoctorLabel, 
          y: topY - yDoctor, 
          size: 9, 
          font: fontBold, 
          color: textColor 
        });
        page.drawText(report.doctor.name, { 
          x: labSettings.usePreprinted ? (labSettings.xDoctor || 110) : 120, 
          y: topY - yDoctor, 
          size: 9, 
          font: fontRegular, 
          color: textColor 
        });
      }

      // Right Column
      // Sample ID
      if (report.sampleId) {
        const xSampleIdLabel = labSettings.usePreprinted ? (labSettings.xSampleIdLabel || 280) : 330;
        const ySampleId = labSettings.usePreprinted ? (labSettings.ySampleId || 15) : 15;
        page.drawText(labSettings.usePreprinted ? `Sample:` : `Sample ID:`, { 
          x: xSampleIdLabel, 
          y: topY - ySampleId, 
          size: 9, 
          font: fontBold, 
          color: textColor 
        });
        page.drawText(report.sampleId, { 
          x: labSettings.usePreprinted ? (labSettings.xSampleId || 340) : 410, 
          y: topY - ySampleId, 
          size: 9, 
          font: fontRegular, 
          color: textColor 
        });
      }

      // Age / Gender (Do not print if age is missing)
      const hasAge = report.patient.age !== null && report.patient.age !== undefined;
      if (hasAge) {
        const xAgeGenderLabel = labSettings.usePreprinted ? (labSettings.xAgeGenderLabel || 280) : 330;
        const yAgeGender = labSettings.usePreprinted ? (labSettings.yAgeGender || 30) : 30;
        page.drawText(labSettings.usePreprinted ? `Age/Sex:` : `Age / Gender:`, { 
          x: xAgeGenderLabel, 
          y: topY - yAgeGender, 
          size: 9, 
          font: fontBold, 
          color: textColor 
        });
        const ageStr = `${report.patient.age} ${(report.patient.ageUnit || 'YEARS').toLowerCase()}`;
        const genderStr = report.patient.gender || 'N/A';
        page.drawText(`${ageStr} / ${genderStr}`, { 
          x: labSettings.usePreprinted ? (labSettings.xAgeGender || 340) : 410, 
          y: topY - yAgeGender, 
          size: 9, 
          font: fontRegular, 
          color: textColor 
        });
      }

      // Reg Date
      if (report.registrationDate) {
        const xRegDateLabel = labSettings.usePreprinted ? (labSettings.xRegDateLabel || 280) : 330;
        const yRegDate = labSettings.usePreprinted ? (labSettings.yRegDate || 45) : 45;
        page.drawText(labSettings.usePreprinted ? `Date:` : `Reg. Date:`, { 
          x: xRegDateLabel, 
          y: topY - yRegDate, 
          size: 9, 
          font: fontBold, 
          color: textColor 
        });
        const regDateStr = new Date(report.registrationDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        page.drawText(regDateStr, { 
          x: labSettings.usePreprinted ? (labSettings.xRegDate || 340) : 410, 
          y: topY - yRegDate, 
          size: 9, 
          font: fontRegular, 
          color: textColor 
        });
      }
    };

    drawPageHeader();
    drawPatientGrid();

    // Table Header drawing
    y = height - (labSettings.tableTopY || 230);
    const drawTableHeader = (currentY: number) => {
      if (!labSettings.usePreprinted) {
        page.drawRectangle({
          x: 40,
          y: currentY,
          width: width - 80,
          height: 20,
          color: themeColor
        });
        const labelColor = rgb(1, 1, 1);
        page.drawText('TEST PARAMETER', { x: 50, y: currentY + 6, size: 8, font: fontBold, color: labelColor });
        page.drawText('OBSERVED VALUE', { x: 230, y: currentY + 6, size: 8, font: fontBold, color: labelColor });
        page.drawText('UNIT', { x: 350, y: currentY + 6, size: 8, font: fontBold, color: labelColor });
        page.drawText('REF. INTERVAL', { x: 430, y: currentY + 6, size: 8, font: fontBold, color: labelColor });
        page.drawText('FLAG', { x: 525, y: currentY + 6, size: 8, font: fontBold, color: labelColor });
      }
      
      return currentY - 10;
    };

    y = drawTableHeader(y);

    // Group results by Test Panel
    for (const reportTest of report.reportTests) {
      const test = reportTest.test;
      const testResults = report.results.filter(r => 
        test.testParameters.some(tp => tp.parameterId === r.parameterId)
      );

      const activeTestResults = testResults.filter(r => {
        const val = String(r.value || '').trim().toLowerCase();
        return val !== '' && !['null', 'n/a', '-', 'undefined', 'empty', 'none'].includes(val);
      });

      if (activeTestResults.length === 0) continue;

      // Check height page overflow before printing Test Section Title
      if (y < 120) {
        page = pdfDoc.addPage([595.28, 841.89]);
        drawPageHeader();
        y = drawTableHeader(height - 150);
      }

      // Draw Test Category Header
      y -= 15;
      page.drawText(test.name.toUpperCase(), {
        x: 50,
        y: y + 2,
        size: 9,
        font: fontBold,
        color: themeColor
      });
      if (!labSettings.usePreprinted) {
        page.drawLine({
          start: { x: 40, y: y - 3 },
          end: { x: width - 40, y: y - 3 },
          thickness: 0.5,
          color: themeColor
        });
      }
      y -= 10;

      // Draw Test Parameters
      for (const result of activeTestResults) {
        if (y < 100) {
          page = pdfDoc.addPage([595.28, 841.89]);
          drawPageHeader();
          y = drawTableHeader(height - 150);
        }

        y -= 18;

        // Strip parameter details
        const parameterName = result.parameter?.name || 'Unknown Parameter';
        const observedValue = result.value || 'N/A';
        const unit = result.unitText || '';
        const refRange = result.referenceRangeText || 'N/A';
        const flag = result.isAbnormal ? 'H / L' : ''; // Flag

        // Parameter Name
        page.drawText(parameterName, {
          x: 55,
          y: y + 2,
          size: 9,
          font: fontRegular,
          color: textColor
        });

        // Value - Highlight if abnormal
        const valueFont = result.isAbnormal ? fontBold : fontRegular;
        const valueColor = result.isAbnormal ? rgb(0.8, 0, 0) : textColor; // Red for abnormal

        page.drawText(observedValue, {
          x: 230,
          y: y + 2,
          size: 9,
          font: valueFont,
          color: valueColor
        });

        // Unit
        page.drawText(unit, {
          x: 350,
          y: y + 2,
          size: 9,
          font: fontRegular,
          color: secondaryColor
        });

        // Reference range
        page.drawText(refRange, {
          x: 430,
          y: y + 2,
          size: 9,
          font: fontRegular,
          color: secondaryColor
        });

        // Abnormal Flag indicator
        if (result.isAbnormal) {
          page.drawText('Abnormal', {
            x: 525,
            y: y + 2,
            size: 8,
            font: fontBold,
            color: rgb(0.8, 0, 0)
          });
        }

        // Underline row
        if (!labSettings.usePreprinted) {
          page.drawLine({
            start: { x: 45, y: y - 4 },
            end: { x: width - 45, y: y - 4 },
            thickness: 0.3,
            color: lineGray
          });
        }
      }
      y -= 10;
    }

    // Draw Report Remarks / Signatures section
    if (y < 200) {
      page = pdfDoc.addPage([595.28, 841.89]);
      drawPageHeader();
      y = height - 150;
    }

    // Divider before signature
    y -= 40;
    if (!labSettings.usePreprinted) {
      page.drawLine({
        start: { x: 40, y: y },
        end: { x: width - 40, y: y },
        thickness: 1,
        color: lineGray
      });
    }

    y -= 15;
    // Remarks
    if (report.remarks) {
      page.drawText(`Remarks: ${report.remarks}`, {
        x: 40,
        y: y,
        size: 9,
        font: fontRegular,
        color: textColor
      });
      y -= 35;
    }

    // Embed Signatures Base64 if available
    const signatureY = y - 50;
    
    // Draw signee names
    page.drawText('Technician Signature', {
      x: 60,
      y: signatureY - 15,
      size: 9,
      font: fontBold,
      color: textColor
    });
    page.drawText('Checked By', {
      x: 60,
      y: signatureY - 27,
      size: 8,
      font: fontRegular,
      color: secondaryColor
    });

    page.drawText('Pathologist Signature', {
      x: width - 170,
      y: signatureY - 15,
      size: 9,
      font: fontBold,
      color: textColor
    });
    page.drawText('Consulting Pathologist', {
      x: width - 170,
      y: signatureY - 27,
      size: 8,
      font: fontRegular,
      color: secondaryColor
    });

    // Draw base64 signature if config is loaded
    if (sigImage) {
      try {
        page.drawImage(sigImage, {
          x: width - 170,
          y: signatureY,
          width: 100,
          height: 40
        });
      } catch (e) {
        logger.error('Failed to draw doctor signature image in PDF:', e);
      }
    }

    // Footer bottom notice
    if (!labSettings.usePreprinted) {
      page.drawRectangle({
        x: 40,
        y: 40,
        width: width - 80,
        height: 35,
        color: rgb(0.97, 0.98, 0.98),
        borderColor: lineGray,
        borderWidth: 0.5
      });
    }

    page.drawText(labSettings.labFooter || 'This report is generated for medical diagnostic evaluation only.', {
      x: 50,
      y: 55,
      size: 7.5,
      font: fontRegular,
      color: secondaryColor
    });

    const pdfBytes = await pdfDoc.save();
    
    // Ensure output directories exist (relative to workspace root)
    const pdfDir = path.resolve(__dirname, '../../../pdf');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const outputFilePath = path.join(pdfDir, `${params.reportId}.pdf`);
    fs.writeFileSync(outputFilePath, pdfBytes);
    logger.info(`PDF generated successfully at: ${outputFilePath}`);

    return outputFilePath;
  } catch (error: any) {
    logger.error('Failed to generate PDF Report:', error);
    throw error;
  }
}

export async function embedBase64Image(pdfDoc: PDFDocument, base64Data: string) {
  const isPng = base64Data.startsWith('data:image/png');
  const cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|jpg|gif);base64,/, '');
  const bytes = Buffer.from(cleanBase64, 'base64');
  return isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
}
