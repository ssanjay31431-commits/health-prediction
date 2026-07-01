const fs = require('fs');
const path = require('path');
const repo = require('../services/patientRepo');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { sendPatientReport } = require('../services/emailService');
const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');

const getLogoPath = () => {
  const envPath = process.env.REPORT_LOGO_PATH;
  const defaultPath = path.resolve(__dirname, '..', 'frontend', 'src', 'assets', 'hero.png');
  if (envPath && fs.existsSync(envPath)) return envPath;
  if (fs.existsSync(defaultPath)) return defaultPath;
  return null;
};

const generatePatientReportPdf = (patient) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const buffers = [];
      const logoPath = getLogoPath();

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const createdAt = new Date(patient.createdAt || Date.now());
      const formattedDate = createdAt.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const reportId = patient._id?.toString() || 'N/A';
      const age = patient.age || (() => {
        const dob = new Date(patient.dob);
        const diff = Date.now() - dob.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      })();
      const gender = patient.gender || 'Not provided';
      const prediction = patient.remarks?.possibleCondition || 'Normal';
      const recommendation = patient.remarks?.recommendation || 'No recommendation available.';
      const resultLabel = prediction.toLowerCase().includes('high') ? 'Positive' : 'Negative';
      const statusLabel = prediction.toLowerCase().includes('high') ? 'High Risk' : 'Normal';
      const website = process.env.FRONTEND_URL || 'Health Prediction System';
      const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'support@healthprediction.com';

      if (logoPath) {
        try {
          doc.image(logoPath, 36, 36, { width: 48, height: 48 });
        } catch (ignore) {
        }
      }

      const headerX = logoPath ? 96 : 36;
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Health Prediction System', headerX, 42);
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text('AI-Based Health Prediction Report', headerX);
      doc.moveDown(0.6);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
      doc.moveDown(0.6);

      // Layout helpers to keep everything on a single page
      const footerHeight = 100;
      const availableBottom = doc.page.height - footerHeight;
      const remainingSpace = () => availableBottom - doc.y;
      const truncate = (text, maxChars) => (text && text.length > maxChars ? text.slice(0, maxChars - 3) + '...' : text);

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Patient Information');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      const infoData = [
        ['Patient Name', patient.name || '-'],
        ['Age', age || '-'],
        ['Gender', gender],
        ['Email', patient.email || '-'],
        ['Mobile', patient.mobile || '-'],
        ['Report Date', formattedDate],
        ['Patient ID', reportId]
      ];
      infoData.forEach(([label, value]) => {
        if (remainingSpace() < 60) return; // don't overflow
        doc.font('Helvetica-Bold').text(`${label}`, { continued: true, width: 140 });
        doc.font('Helvetica').text(`${truncate(String(value || '-'), 80)}`);
      });
      doc.moveDown(0.8);
      // Only render metrics if there is at least one real value
      const metricData = [
        ['Glucose (mg/dL)', patient.glucose != null ? patient.glucose : '-'],
        ['Haemoglobin (g/dL)', patient.haemoglobin != null ? patient.haemoglobin : '-'],
        ['Cholesterol (mg/dL)', patient.cholesterol != null ? patient.cholesterol : '-']
      ];
      const hasMetric = metricData.some((m) => m[1] !== '-');
      if (hasMetric && remainingSpace() > 80) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Health Metrics');
        doc.moveDown(0.3);
        metricData.forEach(([label, value]) => {
          doc.font('Helvetica-Bold').text(`${label}`, { continued: true, width: 220 });
          doc.font('Helvetica').text(`${value}`);
        });
        doc.moveDown(0.6);
      }

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Result Summary');
      doc.moveDown(0.3);
      const resultColor = resultLabel === 'Positive' ? '#b91c1c' : '#15803d';
      doc.fillColor('#111827').font('Helvetica-Bold').text('Result: ', { continued: true, width: 90 });
      doc.fillColor(resultColor).text(resultLabel);
      doc.fillColor('#111827').text('Condition: ', { continued: true, width: 90 });
      doc.font('Helvetica').text(statusLabel);
      doc.moveDown(0.6);

      doc.font('Helvetica-Bold').text('Recommendation:');
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      // Truncate recommendation so the PDF stays single-page
      const recText = truncate((Array.isArray(recommendation) ? recommendation.join('\n') : recommendation), 450) || 'No recommendation available.';
      recText.split(/\n|\r\n?/).forEach((line) => {
        if (!line.trim()) return;
        if (remainingSpace() < 40) return; // avoid overflow
        doc.text(`• ${truncate(line.trim(), 180)}`, { paragraphGap: 2, lineGap: 2 });
      });
      doc.moveDown(0.6);

      if (remainingSpace() > 60) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Notes');
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(9).fillColor('#334155');
        const notesText = truncate('This report is a preliminary health prediction based on the submitted vitals. It does not replace professional medical diagnosis.', 300);
        doc.text(notesText, { align: 'left', lineGap: 3 });
        doc.moveDown(0.6);
      }

      const footerY = doc.page.height - 80;
      doc.fontSize(9).fillColor('#475569').text('Health Prediction System', 36, footerY);
      doc.font('Helvetica').text(`Support: ${supportEmail}`, 36, footerY + 12);
      doc.font('Helvetica').text(`Website: ${website}`, 36, footerY + 24);
      doc.fontSize(8).fillColor('#94a3b8').text('Copyright © 2026', 36, footerY + 38);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

exports.getPatients = async (req, res, next) => {
  try {
    const { q, risk, page = 1, limit = 20 } = req.query;
    const ownerId = req.adminId;
    const isSuperAdmin = req.adminRole === 'Super Admin';
    const result = await repo.list({
      q,
      risk,
      page: Number(page),
      limit: Number(limit),
      ownerId,
      isSuperAdmin
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getPatientById = async (req, res, next) => {
  try {
    const patient = await repo.getById(req.params.id, req.adminId, req.adminRole === 'Super Admin');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    next(err);
  }
};

exports.createPatient = async (req, res, next) => {
  try {
    const payload = { ...req.body, createdBy: req.adminId };
    const isSuperAdmin = req.adminRole === 'Super Admin';
    const patient = await repo.create(payload);
    let responseMessage = 'Patient saved successfully.';

    try {
      const pdfBuffer = await generatePatientReportPdf(patient);
      console.log('PDF Buffer Length:', pdfBuffer?.length);
      logger.info('Sending email...');
      const emailResult = await sendPatientReport(patient, pdfBuffer);
      if (emailResult?.error) {
        responseMessage = 'Patient saved successfully, but the report email could not be delivered.';
        logger.warn(`Report email failed for patient ${patient._id || patient.id}: ${emailResult.message}`);
        logger.error('Email send error details:', emailResult.detail || emailResult);
      } else {
        logger.info('Email sent successfully');
      }
    } catch (emailError) {
      responseMessage = 'Patient saved successfully, but the report email could not be delivered.';
      logger.warn(`Report email failed for patient ${patient._id || patient.id}: ${emailError.message}`);
    }

    if (patient && patient.remarks) {
      let updatePayload = { whatsappSent: false, whatsappError: null };
      try {
        await sendWhatsAppMessage(patient);
        updatePayload.whatsappSent = true;
        logger.info(`WhatsApp sent for patient: ${patient._id}`);
      } catch (whatsappError) {
        updatePayload.whatsappSent = false;
        updatePayload.whatsappError = whatsappError.message;
        logger.warn(`WhatsApp failed for patient ${patient._id}: ${whatsappError.message}`);
      }
      await repo.update(patient._id, updatePayload, req.adminId, isSuperAdmin);
    }

    const refreshedPatient = await repo.getById(patient._id || patient.id, req.adminId, isSuperAdmin);
    return res.status(201).json({ ...refreshedPatient, message: responseMessage });
  } catch (err) {
    next(err);
  }
};

exports.downloadPatientReport = async (req, res, next) => {
  try {
    const patient = await repo.getById(req.params.id, req.adminId, req.adminRole === 'Super Admin');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const pdfBuffer = await generatePatientReportPdf(patient);
    const filename = `Health_Report_${(patient.name || 'Patient').replace(/\s+/g, '_')}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

exports.updatePatient = async (req, res, next) => {
  try {
    const updated = await repo.update(req.params.id, req.body, req.adminId, req.adminRole === 'Super Admin');
    if (!updated) return res.status(404).json({ message: 'Patient not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deletePatient = async (req, res, next) => {
  try {
    const ok = await repo.remove(req.params.id, req.adminId, req.adminRole === 'Super Admin');
    if (!ok) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
