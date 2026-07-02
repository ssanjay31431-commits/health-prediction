const geminiService = require('../services/geminiService');
const { sendPatientNotification } = require('../services/brevoEmailService');

exports.predict = async (req, res, next) => {
  try {
    const { glucose, haemoglobin, cholesterol, name, email, mobile } = req.body;
    if ([glucose, haemoglobin, cholesterol].some((v) => v == null)) {
      return res.status(400).json({ message: 'glucose, haemoglobin and cholesterol are required' });
    }

    const remarks = await geminiService.predict({ glucose, haemoglobin, cholesterol });
    let message = 'Health prediction generated successfully.';

    if (email) {
      try {
        await sendPatientNotification({ name, email, mobile, remarks });
        message = `Prediction emailed to ${email}`;
      } catch (emailError) {
        message = 'Prediction generated, but email delivery failed.';
      }
    }

    res.json({ remarks, message });
  } catch (err) {
    next(err);
  }
};
