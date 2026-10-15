# Anuj Yadav — AI engineering portfolio

Live portfolio: https://codesensitive.github.io/

Evidence Lab runs PDF/text/image ingestion, optional English OCR, and BM25 or local embedding retrieval in the visitor's browser. PDF citations and JSON traces retain page numbers and OCR provenance. MiniLM and BGE weights download from Hugging Face; inference runs locally. Document contents are not sent to a service. Optional WebLLM answer generation runs on the visitor's GPU after an explicit model download; evidence-only mode is the default. Documents and vectors stay in session memory; model files can be cached by the browser. Fonts load from Google Fonts.

## Develop

Requires Node.js 24 for development and tests. Visitors do not install anything. PDF.js 6.4.299 and its worker, character maps, fonts, and WASM resources are served with the static site, with its license retained.

```sh
npm ci
npm run prepare:ai
npm start
npm test
```

Open http://127.0.0.1:4173 for local preview.

## Files

- `dist/index.html`: portfolio and interface
- `dist/style.css`: responsive styling
- `dist/engine.js`: chunking, tokenization, BM25, extraction, sample evaluation
- `dist/app.js`: uploads, controls, citations, query trace export
- `dist/documents.js`: format validation, UTF-8 decoding, PDF parsing and resource limits
- `dist/models.js`: local model catalog, cosine ranking and cutoffs
- `dist/embeddings.js` and `dist/embedding-worker.js`: cancellable model loading, vector indexing, and semantic search in a Web Worker
- `dist/ocr.js`: Tesseract English OCR for rasterized PDF pages and images
- `dist/vendor/pdfjs/`: pinned browser PDF.js runtime and license
- `dist/vendor/transformers`, `ort`, and `ocr`: locally served embedding/OCR runtimes and English language data
- `tests.mjs`: retrieval smoke tests
- `tests/fixtures/`: synthetic PDFs for positive and negative tests
- `scripts/prepare-pdf.mjs`: refresh vendored runtime after an intentional PDF.js dependency update (`npm run prepare:pdf`)
- `scripts/prepare-ai.mjs`: refresh embedding/OCR/WebLLM runtime assets (`npm run prepare:ai`)

## Deploy

GitHub Pages publishes `dist` via `.github/workflows/pages.yml` on pushes to `main`. Pages uses GitHub Actions as its build source. Local edits need to be committed and pushed to become live.

The UI supports PDF, UTF-8 .txt/.md and PNG/JPEG files, up to 2 MiB per file, 20 documents and 8 MiB of extracted text per session. Text PDFs are limited to 100 pages. Enable English OCR to read textless scanned pages (up to 10 per PDF) or images. OCR can contain errors and does not process image text on a page that already has selectable text. Image input is limited to 16 megapixels. Password-protected and damaged PDFs return actionable errors. Reading order in complex layouts may vary.

Local semantic retrieval supports up to 200 chunks, uses quantized 384-dimensional MiniLM/BGE embeddings, and rebuilds vectors when the model or corpus changes. Cosine cutoffs (MiniLM 0.25, BGE 0.5) are heuristics, not confidence or factual support. Long inputs are truncated to the selected model's token limit. BM25 remains available without downloading a model. The included on-page evaluation tests the BM25 sample corpus, independently of selected model and uploaded files.

Hybrid modes merge BM25 and MiniLM/BGE candidate ranks with RRF. The Compare retrieval button runs a real four-method comparison on a labeled synthetic corpus, with Hit@1, Recall@3, MRR@3 and no-answer false evidence. Results and per-query labels are inspectable and downloadable; they are not a universal model leaderboard. A measured run is saved in `evaluation/` for reference; the website computes fresh results rather than displaying those saved numbers.

See `HYBRID_RETRIEVAL_GUIDE.md` for fusion and evaluation details, and `SEMANTIC_OCR_GUIDE.md` for model sources, caching, Google/Microsoft distinctions, and OCR limitations.

GitHub Actions runs the automated tests before deploying. Browser end-to-end coverage is recorded in `TEST_REPORT.md`.

See `WEBLLM_GUIDE.md` for local answer generation, model sizes, GPU requirements, privacy, limitations and implementation details.

The live lab has Simple (default) and Advanced tiles. Simple handles model/retrieval/OCR choices automatically after upload and question submission. Advanced exposes all strategy controls and evaluation tools. See WEBLLM_GUIDE.md for defaults, downloads and fallback behavior.
