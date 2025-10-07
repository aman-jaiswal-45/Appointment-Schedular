# AI-Powered Appointment Scheduler Assistant

This is a backend service built with Node.js that parses natural language appointment requests from either text or images and converts them into structured JSON data. The project implements a multi-step AI pipeline for entity extraction, normalization, and validation.

## Architecture

The application is built on a modular, service-oriented architecture using Node.js and Express.js.

### Server: 
    An Express.js server handles routing and API requests.
### Database: 
    MongoDB (with Mongoose) is used to store the structured appointment data.
### API Endpoints: 
    The service exposes two main endpoints:
    1. POST /api/parse/text: For parsing plain text queries.
    2. POST /api/parse/document: For parsing text from uploaded images.
### AI Pipeline (ai.service.js): 
    This is the core of the application. It uses a two-step AI chain with the Google Gemini API to process text:
    1. Entity Extraction: The first AI call identifies key phrases (like "next Friday," "3pm," "dentist") and assigns a confidence score.
    2. Normalization & Validation: The extracted entities are fed into a second AI call which normalizes them into a structured format (date, time, tz), assigns a      final status (ok or needs_clarification), and provides a confidence score.

### Image Processing (OCR): 
    For the document endpoint, the flow is:
    Multer middleware saves the uploaded image to a temporary local folder (/uploads).
    Tesseract.js performs OCR on the local image file to extract the raw text.
    The extracted text is then sent to the same AI pipeline.
    
A finally block in the controller ensures the temporary image file is always deleted after processing to keep the server clean.

# Setup and Installation
To run this project locally, please follow these steps:

## Install dependencies:
    npm install
    npm i express axios dotenv nodemon multer mongoose tesseract.js

## Create the environment file:
Create a .env file in the root directory and add the following variables:

### Server Port
    PORT=3000
### MongoDB Connection URI
    MONGODB_URI=[Your MongoDB Connection String]
### Google Gemini API Key
    AI_API_KEY=[Your Google AI Studio API Key]

## Create the uploads folder:
    Create a folder named uploads in the root of the project. This is required for the document processing endpoint.

## Start the server:
     npm run dev (Using nodemon make some changes in package.json)

### The server will be running at http://localhost:3000.

# API Usage Examples (Postman)
## 1. Parse a Text Request
    Endpoint: POST /api/parse/text
    Body: raw (JSON)
    
    Sample Request Body:
    {
        "query": "Book a dental check-up for next Monday at 10 AM"
    }
    
    Sample Success Response (201 Created):
    {
    "pipeline_results": {
        "step1_extraction": {
            "raw_text": "Book a dental check-up for next Monday at 10 AM",
            "confidence": 1
        },
        "step2_entities": {
            "entities": {
                "date_phrase": "next Monday",
                "time_phrase": "10 AM",
                "department": "dental"
            },
            "entities_confidence": 0.95
        },
        "step3_normalization": {
            "normalized": {
                "date": "2025-10-13",
                "time": "10:00",
                "tz": "Asia/Kolkata"
            },
            "normalization_confidence": 0.95
        },
        "step4_final": {
            "appointment": {
                "department": "Dentistry",
                "date": "2025-10-13",
                "time": "10:00",
                "tz": "Asia/Kolkata"
            },
            "status": "ok"
        }
    }
    }


## 2. Parse a Document (Image) Request
    Endpoint: POST /api/parse/document
    Body: form-data
    Key: document
    Value: (Set type to File and upload an image)

## 3. Ambiguous Request (Guardrail)
    Endpoint: POST /api/parse/text
    Body: raw (JSON)
    
    Sample Request Body:

    {
        "query": "Book a appointment on oct 10 at 10 AM"
    }

    Sample Error Response (400 Bad Request):

    {
        "status": "needs_clarification",
        "message": "Missing fields in final appointment.",
        "missing": [
            "department"
        ]
    }
