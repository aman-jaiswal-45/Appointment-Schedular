import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
// --- GEMINI MODEL SELECTION --- 
async function getValidGeminiModel() {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.AI_API_KEY}`;
    try {
        const res = await axios.get(listUrl);
        const model = res.data.models?.find((m) => m.supportedGenerationMethods?.includes("generateContent"));
        if (model) {
            console.log(`Using Gemini model: ${model.name}`);
            return model.name;
        }
        throw new Error("No supported Gemini model found.");
    } catch (err) {
        console.error("Could not fetch model list:", err.message);
        console.log("Using fallback model: models/gemini-1.0-pro");
        return "models/gemini-1.0-pro";
    }
}

// --- Helper to call the Gemini API ---
async function callGemini(prompt, modelName) {
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${process.env.AI_API_KEY}`;
    const requestBody = { contents: [{ parts: [{ text: prompt }] }] };
    const response = await axios.post(apiEndpoint, requestBody, { headers: { "Content-Type": "application/json" } });
    const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!responseText) { throw new Error("Empty AI response"); }
    return JSON.parse(responseText.replace(/```json/g, "").replace(/```/g, "").trim());
}

// --- THE PIPELINE FUNCTION ---
export async function parseAppointmentPipeline(rawText) {
    try {
        const modelName = await getValidGeminiModel();
        const fullResponse = {};

        // --- Step 1: OCR/Text Extraction ---
        fullResponse.step1_extraction = {
            raw_text: rawText,
            confidence: 1.0
        }; 

        // --- Step 2: Entity Extraction (First AI Call) ---
        const extractionPrompt = `
            You are an expert entity extraction system. From the following text, extract the date phrase, time phrase, and department.
            Provide a confidence score (0.0 to 1.0) for the extracted entities as a whole.
            The current date is ${new Date().toISOString()}.
            Respond ONLY with a JSON object in this exact format: {"entities": {"date_phrase": "...", "time_phrase": "...", "department": "..."}, "entities_confidence": 0.85}

            Text: "${rawText}"
        `;
        const extractionResult = await callGemini(extractionPrompt, modelName);
        fullResponse.step2_entities = extractionResult;

        // Guardrail: Check for low confidence or missing critical information
        if (extractionResult.entities_confidence < 0.6 || !extractionResult.entities.date_phrase) {
             return { status: "needs_clarification", message: "Ambiguous date/time or department." };
        }

        // --- Step 3 & 4: Normalization & Finalization (Second AI Call) ---
        const normalizationPrompt = `
            You are an expert data normalization and finalization system. Given the extracted entities, your task is to:
            1. Normalize the date and time phrases for the "Asia/Kolkata" timezone into "YYYY-MM-DD" and "HH:mm" format.
            2. Provide a confidence score for this normalization.
            3. Standardize the department name (e.g., "dentist" becomes "Dentistry").
            4. Assemble the final appointment object.
            The current date is ${new Date().toISOString()}.
            Respond ONLY with a JSON object with this exact structure:
            {
                "normalized": { "date": "...", "time": "...", "tz": "Asia/Kolkata" },
                "normalization_confidence": 0.90,
                "appointment": { "department": "...", "date": "...", "time": "...", "tz": "Asia/Kolkata" },
                "status": "ok"
            }

            Extracted Entities: ${JSON.stringify(extractionResult.entities)}
        `;
        const finalizationResult = await callGemini(normalizationPrompt, modelName);
        
        fullResponse.step3_normalization = {
            normalized: finalizationResult.normalized,
            normalization_confidence: finalizationResult.normalization_confidence
        };
        fullResponse.step4_final = {
            appointment: finalizationResult.appointment,
            status: finalizationResult.status
        };
        
        return fullResponse;

    } catch (error) {
        console.error("Error in AI Pipeline:", error.response ? error.response.data : error.message);
        return { status: "needs_clarification", message: "An error occurred during parsing." };
    }
}
