const axios = require('axios');
const logger = require('../utils/logger');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gpt-4.1-mini';
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/responses';

// This service calls a generative AI API. If API key is not present, it falls back to a heuristic.
exports.predict = async ({ glucose, haemoglobin, cholesterol }) => {
  const prompt = `Given glucose=${glucose}, haemoglobin=${haemoglobin}, cholesterol=${cholesterol}, provide: Possible Condition, Reason, Recommendation in JSON.`;

  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set, using fallback heuristic');
    let possibleCondition = 'Normal';
    let reason = 'All values within typical ranges.';
    let recommendation = 'Maintain healthy lifestyle.';

    if (glucose > 125) {
      possibleCondition = 'High Risk of Diabetes';
      reason = 'Glucose level is above normal.';
      recommendation = 'Consult a doctor and maintain a healthy diet.';
    } else if (cholesterol > 240) {
      possibleCondition = 'High Cholesterol';
      reason = 'Cholesterol level is high.';
      recommendation = 'Consider lipid-lowering diet and consult physician.';
    } else if (haemoglobin < 12) {
      possibleCondition = 'Low Haemoglobin / Anemia risk';
      reason = 'Haemoglobin is below normal.';
      recommendation = 'Get iron-rich foods and consult a physician.';
    }

    return { possibleCondition, reason, recommendation };
  }

  try {
    const res = await axios.post(
      OPENAI_API_URL,
      {
        model: GEMINI_MODEL,
        input: prompt,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const outputText =
      res.data?.output?.[0]?.content?.find((item) => item.type === 'output_text')?.text ||
      res.data?.output?.[0]?.content?.[0]?.text ||
      res.data?.choices?.[0]?.message?.content ||
      res.data?.choices?.[0]?.text;
    const text = outputText || JSON.stringify(res.data);

    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch (parseErr) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      return { possibleCondition: text, reason: '', recommendation: '' };
    }
  } catch (err) {
    logger.error('Gemini API error', err.message || err);
    throw new Error('Prediction service unavailable');
  }
};
