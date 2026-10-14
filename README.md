# Anuj Yadav — AI engineering portfolio

Live portfolio: https://codesensitive.github.io/

Evidence Lab runs PDF/text/Markdown ingestion, overlapping chunks, BM25 ranking, and cited extractive Q&A entirely in the visitor's browser. PDFs are parsed locally with the vendored PDF.js runtime; document text is not sent to a service. PDF citations and JSON traces retain page numbers. It does not use an LLM or vector embeddings. Files remain in session memory; reloading restores samples. Fonts load from Google Fonts.

## Develop

Requires Node.js 24 for development and tests. Visitors do not install anything. PDF.js 6.4.299 and its worker, character maps, fonts, and WASM resources are served with the static site, with its license retained.

```sh
npm ci
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
- `dist/vendor/pdfjs/`: pinned browser PDF.js runtime and license
- `tests.mjs`: retrieval smoke tests
- `tests/fixtures/`: synthetic PDFs for positive and negative tests
- `scripts/prepare-pdf.mjs`: refresh vendored runtime after an intentional PDF.js dependency update (`npm run prepare:pdf`)

## Deploy

GitHub Pages publishes `dist` via `.github/workflows/pages.yml` on pushes to `main`. Pages uses GitHub Actions as its build source. Local edits need to be committed and pushed to become live.

The UI supports selectable-text PDFs and UTF-8 .txt/.md files, up to 2 MiB per file, 20 documents and 8 MiB of extracted text per session. PDFs are limited to 100 pages and 30 seconds of parsing. Password-protected and damaged PDFs return actionable errors. Scanned/image-only PDFs require OCR and are unsupported; partially textless PDFs show a warning. Reading order in complex layouts may vary. Retrieval matches terms rather than meaning; a positive score is not confidence. The bundled evaluation is a small deterministic smoke suite, not a production quality benchmark.

GitHub Actions runs the automated tests before deploying. Browser end-to-end coverage is recorded in `TEST_REPORT.md`.
