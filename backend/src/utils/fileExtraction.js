import fs from "fs/promises";
import Tesseract from "tesseract.js";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extracts text from a given file path based on its MIME type.
 * Safely handles images (via Tesseract) and PDFs (via pdf-parse).
 * 
 * @param {string} filePath - Absolute path to the file
 * @param {string} mimeType - MIME type (e.g. 'application/pdf', 'image/jpeg')
 * @returns {Promise<string>} - Extracted text
 */
export async function extractTextFromFile(filePath, mimeType) {
	try {
		if (mimeType === 'application/pdf') {
			const dataBuffer = await fs.readFile(filePath);
			const pdfData = await pdfParse(dataBuffer);
			return pdfData.text?.trim() || '';
		} else {
			const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
			return text?.trim() || '';
		}
	} catch (error) {
		console.error(`[EXTRACTION] Failed to extract text from ${filePath} (${mimeType}):`, error.message);
		return '';
	}
}
