import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import Tesseract from "tesseract.js";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.PDFParse || pdfParseModule.default);
const execFileAsync = promisify(execFile);

/**
 * Extracts text from a given file path based on its MIME type.
 *
 * PDFs  → pdf-parse (handles digitally-typed PDFs)
 *       → If text < 30 chars (scanned PDF), uses PyMuPDF via python to render to image, then OCRs.
 * Images → Tesseract OCR (handles JPG, PNG, TIFF, BMP etc.)
 *
 * @param {string} filePath - Absolute path to the uploaded file
 * @param {string} mimeType - MIME type (e.g. 'application/pdf', 'image/jpeg')
 * @returns {Promise<string>} - Extracted text, or '' on failure
 */
export async function extractTextFromFile(filePath, mimeType) {
	// ── PDF: use pdf-parse, fallback to PyMuPDF + Tesseract ────────────────────
	if (mimeType === 'application/pdf') {
		try {
			const dataBuffer = await fs.readFile(filePath);
			const pdfData    = await pdfParse(dataBuffer);
			const text       = pdfData.text?.trim() || '';
			if (text.length >= 30) {
				console.log(`[EXTRACTION] pdf-parse: ${text.length} chars extracted from PDF`);
				return text;
			}
			console.log(`[EXTRACTION] pdf-parse returned <30 chars. Treating as Scanned PDF.`);
		} catch (err) {
			console.error('[EXTRACTION] pdf-parse failed:', err.message);
		}

		// Fallback for scanned PDF: Render to image using Python (PyMuPDF)
		const tempImgPath = `${filePath}_temp.png`;
		try {
			console.log(`[EXTRACTION] Rendering PDF to image for OCR...`);
			const scriptPath = path.join(process.cwd(), 'src', 'utils', 'pdfToImage.py');
			await execFileAsync('python', [scriptPath, filePath, tempImgPath]);

			console.log(`[EXTRACTION] Image rendered, running Tesseract OCR...`);
			const { data: { text } } = await Tesseract.recognize(tempImgPath, 'eng');
			const extracted = text?.trim() || '';
			console.log(`[EXTRACTION] Scanned PDF OCR complete: ${extracted.length} chars`);
			
			// Cleanup temp image
			try { await fs.unlink(tempImgPath); } catch {}
			return extracted;

		} catch (ocrErr) {
			console.error('[EXTRACTION] Scanned PDF OCR failed:', ocrErr.message);
			try { await fs.unlink(tempImgPath); } catch {}
			return '';
		}
	}

	// ── Image (JPG / PNG / TIFF / BMP): use Tesseract OCR ────────────────────
	const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp'];
	if (imageTypes.includes(mimeType)) {
		try {
			const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
			const extracted = text?.trim() || '';
			console.log(`[EXTRACTION] Tesseract OCR: ${extracted.length} chars extracted`);
			return extracted;
		} catch (err) {
			console.error('[EXTRACTION] Tesseract OCR failed:', err.message);
			return '';
		}
	}

	// ── Unsupported format ─────────────────────────────────────────────────────
	console.warn(`[EXTRACTION] Unsupported MIME type: ${mimeType}`);
	return '';
}

