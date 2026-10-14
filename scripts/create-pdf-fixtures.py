from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures'
root.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(root / 'project-brief.pdf'), pagesize=A4)
pdf.setTitle('Evidence Lab synthetic PDF test')
pages = [
    ('Project Brief - Synthetic Test', ['The project codename is Marigold.', 'The retrieval engine uses BM25 ranking.', 'The latency target is 42.5 milliseconds.', 'These are synthetic facts for application testing.']),
    ('Release Plan - Synthetic Test', ['The release owner is Anuj Yadav.', 'The launch date is 21 November 2026.', 'The support window is fourteen days.', 'These are synthetic facts for application testing.'])
]
for heading, lines in pages:
    pdf.setFont('Helvetica-Bold', 18)
    pdf.drawString(50, 780, heading)
    pdf.setFont('Helvetica', 12)
    for i, line in enumerate(lines):
        pdf.drawString(50, 735 - i * 25, line)
    pdf.showPage()
pdf.save()
writer = PdfWriter()
writer.add_blank_page(width=595, height=842)
with (root / 'no-text.pdf').open('wb') as out:
    writer.write(out)
writer = PdfWriter()
for page in PdfReader(root / 'project-brief.pdf').pages:
    writer.add_page(page)
writer.encrypt('test-password')
with (root / 'locked.pdf').open('wb') as out:
    writer.write(out)
(root / 'broken.pdf').write_bytes(b'%PDF-1.7\nthis is not a valid PDF')
(root / 'extra.txt').write_text('The rollback contact is Mira Sen.', encoding='utf-8')
writer = PdfWriter()
for _ in range(101):
    writer.add_blank_page(width=595, height=842)
with (root / 'too-many-pages.pdf').open('wb') as out:
    writer.write(out)
print('PDF fixtures written to', root)
