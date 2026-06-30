const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const getLogoPath = () => {
  const envPath = process.env.REPORT_LOGO_PATH;
  const defaultPath = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'assets', 'hero.png');
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
      const age = patient.age != null
        ? patient.age
        : patient.dob
          ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
          : 'Not provided';
      const gender = patient.gender || 'Not provided';
      const prediction = patient.remarks?.possibleCondition || 'Normal';
      const recommendation = patient.remarks?.recommendation || 'No recommendation available.';
      const resultLabel = prediction.toLowerCase().includes('high') ? 'Positive' : 'Negative';
      const statusLabel = prediction.toLowerCase().includes('high') ? 'High Risk' : 'Normal';
      const website = process.env.FRONTEND_URL || 'Health Prediction System';
      const supportEmail = process.env.SUPPORT_EMAIL || 'support@healthprediction.com';

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

      const availableBottom = doc.page.height - 100;
      const remainingSpace = () => availableBottom - doc.y;
      const truncate = (text, maxChars) => (text && text.length > maxChars ? text.slice(0, maxChars - 3) + '...' : text);

      infoData.forEach(([label, value]) => {
        if (remainingSpace() < 60) return;
        doc.font('Helvetica-Bold').text(`${label}`, { continued: true, width: 140 });
        doc.font('Helvetica').text(`${truncate(String(value || '-'), 80)}`);
      });

      doc.moveDown(0.8);
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
      const recText = truncate(Array.isArray(recommendation) ? recommendation.join('\n') : recommendation, 450) || 'No recommendation available.';
      recText.split(/\n|\r\n?/).forEach((line) => {
        if (!line.trim()) return;
        if (remainingSpace() < 40) return;
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

module.exports = {
  generatePatientReportPdf
};
