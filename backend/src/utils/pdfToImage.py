import sys
import fitz

if len(sys.argv) < 3:
    sys.exit(1)

pdf_path = sys.argv[1]
out_path = sys.argv[2]

try:
    doc = fitz.open(pdf_path)
    if len(doc) > 0:
        page = doc.load_page(0)
        pix = page.get_pixmap(dpi=150)
        pix.save(out_path)
except Exception as e:
    print(e)
    sys.exit(1)
