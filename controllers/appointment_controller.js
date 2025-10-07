import { parseAppointmentPipeline } from '../services/ai_service.js';
import Appointment from '../models/appointment_model.js';
import Tesseract from 'tesseract.js';
import fs from 'fs/promises';

function buildISTDate(dateYMD, timeHM) {
  if (!dateYMD || !timeHM) return null;
  const isoWithOffset = `${dateYMD}T${timeHM}:00.000+05:30`;
  const d = new Date(isoWithOffset);
  return isNaN(d.getTime()) ? null : d;
}

async function processAndSave(pipelineResult, originalQuery, res) {
  // If pipeline says it needs clarification, just forward that to client (400)
  if (!pipelineResult) {
    return res.status(400).json({ status: 'needs_clarification', message: 'No parsing result' });
  }

  // If pipeline returned a guardrail
  if (pipelineResult.status === 'needs_clarification') {
    return res.status(400).json(pipelineResult);
  }

  // Otherwise we expect step4_final.appointment with normalized date/time
  const final = pipelineResult.step4_final;
  if (!final || final.status !== 'ok' || !final.appointment) {
    return res.status(400).json({ status: 'needs_clarification', message: 'AI did not produce a final appointment.', detail: final || null });
  }

  const { department, date, time } = final.appointment;
  
  const missing = [];
  if (!department) missing.push('department');
  if (!date) missing.push('date');
  if (!time) missing.push('time');
  if (missing.length > 0) {
    return res.status(400).json({ status: 'needs_clarification', message: 'Missing fields in final appointment.', missing });
  }

  const appointmentDateTime = buildISTDate(date, time);
  if (!appointmentDateTime) {
    return res.status(400).json({ status: 'needs_clarification', message: 'Invalid date/time combination.', date, time });
  }

  try {
    const newAppointment = new Appointment({
      department: department,
      appointmentDate: appointmentDateTime,
      reason: department,
      originalQuery,
    });

    await newAppointment.save();

    return res.status(201).json({
      status: 'ok',
      pipeline_results: pipelineResult
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error while saving appointment.' });
  }
}

export const parseTextController = async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query text is required.' });

  try {
    const pipelineResult = await parseAppointmentPipeline(query);
    return processAndSave(pipelineResult, query, res);
  } catch (err) {
    console.error("parseTextController Error:", err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
};

export const parseDocumentController = async (req, res) => {
  if (!req.file) {
    console.log("ERROR: req.file is missing. Middleware likely failed.");
    return res.status(400).json({ error: 'No document image was uploaded or middleware failed.' });
  }

  const filePath = req.file.path;
  try {
    const { data: { text: ocrText } } = await Tesseract.recognize(filePath, 'eng');

    if (!ocrText || ocrText.trim() === '') {
      return res.status(400).json({ status: "needs_clarification", message: 'Could not extract text from the document.Please upload a better quality image.' });
    }

    const pipelineResult = await parseAppointmentPipeline(ocrText);
    return processAndSave(pipelineResult, `Parsed from document: ${req.file.originalname}`, res);

  } catch (error) {
    console.error("parseDocumentController Error:", error);
    return res.status(500).json({ error: 'An internal server error occurred while processing the document.' });
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      console.error("ERROR: Failed to delete temporary file:", filePath, cleanupError);
    }
  }
};
