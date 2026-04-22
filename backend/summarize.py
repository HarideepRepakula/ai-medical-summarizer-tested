import sys
import os
import re
import json
import warnings
import torch
import pdfplumber
from transformers import BartForConditionalGeneration, BartTokenizer

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
warnings.filterwarnings("ignore")

print("Loading BART model...", file=sys.stderr)

try:
    model_name = "facebook/bart-large-cnn"
    tokenizer = BartTokenizer.from_pretrained(model_name)
    model = BartForConditionalGeneration.from_pretrained(model_name)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    model.eval()

    print("BART model ready.", file=sys.stderr)

    COMMON_MEDS = [
        "Paracetamol", "Amoxicillin", "Aspirin", "Metformin", "Ibuprofen",
        "Atorvastatin", "Amlodipine", "Omeprazole", "Azithromycin", "Cetirizine",
        "Dolo", "Crocin", "Pantoprazole", "Losartan", "Lisinopril",
        "Metoprolol", "Ciprofloxacin", "Doxycycline", "Prednisone", "Insulin",
        "Thyroxine", "Levothyroxine", "Methotrexate", "Warfarin", "Heparin",
        "Ranitidine", "Montelukast", "Salbutamol", "Prednisolone", "Diclofenac",
        "Tramadol", "Gabapentin", "Amitriptyline", "Sertraline", "Alprazolam",
        "Clonazepam", "Atenolol", "Ramipril", "Telmisartan", "Glimepiride",
        "Vildagliptin", "Sitagliptin", "Rosuvastatin", "Clopidogrel", "Enoxaparin",
        "Folic Acid", "Vitamin D", "Calcium", "Iron", "Zinc", "B12",
        "Levocetirizine", "Fexofenadine", "Hydroxyzine", "Ondansetron", "Domperidone",
        "Metoclopramide", "Esomeprazole", "Rabeprazole", "Sucralfate", "Lactulose"
    ]

    # Dosage pattern: matches "Dolo 650", "Amoxicillin 500mg", "Tab Metformin 500"
    DOSAGE_PATTERN = re.compile(
        r'(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syrup|inj|injection|drops?)?\s*'
        r'([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|IU|units?))',
        re.IGNORECASE
    )

    CLINICAL_UNITS = [
        '%', 'mg/dL', 'g/dL', 'g/L', 'fl', 'fL', 'pg', 'mIU/L', 'uIU/mL',
        'mmol/L', 'IU/L', 'U/L', 'mEq/L', 'ng/mL', 'ug/dL', 'nmol/L',
        'cells/uL', 'x10', 'K/uL', 'M/uL', 'mm/hr', 'sec', 'ratio'
    ]

    def extract_text_from_pdf(pdf_path):
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()

    def extract_clinical_lines(text):
        """Pass 1: Pull only lines containing actual lab values (numbers + units)."""
        lines = text.split('\n')
        clinical = []
        for line in lines:
            line = line.strip()
            if not line or len(line) < 5:
                continue
            has_number = bool(re.search(r'\d+\.?\d*', line))
            has_unit = any(unit in line for unit in CLINICAL_UNITS)
            if has_number and has_unit:
                clinical.append(line)
        return clinical

    def flag_abnormals(clinical_lines):
        """Regex-based flagging for common abnormal patterns — no AI needed."""
        flags = []
        patterns = [
            (r'hb[a]?1c.*?(\d+\.?\d*)', 'HbA1c', 5.7, 6.4, '%'),
            (r'hemoglobin.*?(\d+\.?\d*)', 'Hemoglobin', 12.0, 17.5, 'g/dL'),
            (r'tsh.*?(\d+\.?\d*)', 'TSH', 0.4, 4.0, 'mIU/L'),
            (r'glucose.*?(\d+\.?\d*)', 'Glucose', 70, 100, 'mg/dL'),
            (r'triglyceride.*?(\d+\.?\d*)', 'Triglycerides', 0, 150, 'mg/dL'),
            (r'egfr.*?(\d+\.?\d*)', 'eGFR', 60, 999, 'mL/min'),
            (r'creatinine.*?(\d+\.?\d*)', 'Creatinine', 0.6, 1.2, 'mg/dL'),
        ]
        combined = ' '.join(clinical_lines).lower()
        for pattern, name, low, high, unit in patterns:
            match = re.search(pattern, combined)
            if match:
                try:
                    val = float(match.group(1))
                    if val < low:
                        flags.append(f"{name}: {val} {unit} [LOW]")
                    elif val > high:
                        flags.append(f"{name}: {val} {unit} [HIGH]")
                    else:
                        flags.append(f"{name}: {val} {unit} [Normal]")
                except ValueError:
                    pass
        return flags

    def summarize_chunk(text):
        inputs = tokenizer(text, return_tensors="pt", max_length=1024, truncation=True).to(device)
        with torch.no_grad():
            ids = model.generate(inputs["input_ids"], num_beams=4, max_length=120, early_stopping=True)
        return tokenizer.decode(ids[0], skip_special_tokens=True)

    def generate_bart_summary(text):
        # Pass 1: extract only clinical result lines
        clinical_lines = extract_clinical_lines(text)
        flags = flag_abnormals(clinical_lines)

        # Build BART input: flagged values first, then clinical lines
        flag_text = "Key findings: " + "; ".join(flags) + ". " if flags else ""
        clinical_text = " ".join(clinical_lines[:60])
        bart_input = (flag_text + clinical_text).strip()

        # Fall back to raw text if extraction found nothing
        if not bart_input:
            bart_input = text

        # Pass 2: chunk + summarize
        chunks = [bart_input[i:i+2000] for i in range(0, min(len(bart_input), 16000), 2000)]
        partial = [summarize_chunk(c) for c in chunks if c.strip()]

        if not partial:
            return "Unable to generate summary from the provided document."

        if len(partial) == 1:
            final_summary = partial[0]
        else:
            combined = " ".join(partial)
            final_inputs = tokenizer(combined[:3000], return_tensors="pt", max_length=1024, truncation=True).to(device)
            with torch.no_grad():
                final_ids = model.generate(
                    final_inputs["input_ids"],
                    num_beams=4,
                    max_length=200,
                    min_length=60,
                    length_penalty=2.0,
                    early_stopping=True
                )
            final_summary = tokenizer.decode(final_ids[0], skip_special_tokens=True)

        # Prepend flagged values so they always appear in the summary
        if flags:
            final_summary = "Clinical Flags: " + "; ".join(flags) + "\n\n" + final_summary

        return final_summary

    def process_medical_data(text):
        summary_text = generate_bart_summary(text)
        text_lower = (text + " " + summary_text).lower()

        # 1. Match against known med names
        found_meds = [m for m in COMMON_MEDS if m.lower() in text_lower]

        # 2. Extract "Name Dosage" patterns (e.g. "Dolo 650", "Metformin 500mg")
        dosage_matches = DOSAGE_PATTERN.findall(text)
        for name, dose in dosage_matches:
            entry = f"{name.strip()} {dose.strip()}"
            if not any(m.lower() == name.strip().lower() for m in found_meds):
                found_meds.append(entry)

        # Deduplicate preserving order
        seen = set()
        unique_meds = []
        for m in found_meds:
            key = m.lower()
            if key not in seen:
                seen.add(key)
                unique_meds.append(m)

        return json.dumps({"summary": summary_text, "extracted_meds": unique_meds})

    if __name__ == "__main__":
        if len(sys.argv) > 1:
            file_path = sys.argv[1]
            if file_path.endswith('.pdf'):
                print(f"Extracting text from PDF: {file_path}", file=sys.stderr)
                content = extract_text_from_pdf(file_path)
            else:
                content = sys.stdin.read()
        else:
            content = sys.stdin.read()

        if not content.strip():
            print("Error: No text provided", file=sys.stderr)
            sys.exit(1)

        print(process_medical_data(content))

except Exception as e:
    print(f"BART Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
