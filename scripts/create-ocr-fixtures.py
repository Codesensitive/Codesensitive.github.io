from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
root = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures'
image = Image.new('RGB', (1400, 650), 'white')
draw = ImageDraw.Draw(image)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 38)
for i, line in enumerate(['SYNTHETIC SCANNED PROJECT NOTE', 'The observatory codename is Cobalt.', 'The telescope inspection is scheduled for 18 December 2026.', 'The maintenance lead is Maya Rao.']):
    draw.text((60, 60 + i * 110), line, font=font, fill='black')
image.save(root / 'scanned-note.png')
pdf = canvas.Canvas(str(root / 'scanned-note.pdf'), pagesize=(700,325))
pdf.drawImage(ImageReader(image), 0, 0, width=700, height=325)
pdf.showPage(); pdf.save()
(root / 'semantic.txt').write_text('A motor vehicle requires gasoline to operate. The automobile stores fuel in its tank. A mechanic repairs its engine and transmission.', encoding='utf-8')
print('Scanned image/PDF and semantic fixtures written.')
