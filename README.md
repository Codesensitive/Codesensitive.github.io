# Anuj Yadav — AI engineering portfolio

Live portfolio: https://codesensitive.github.io/

Evidence Lab runs text/Markdown ingestion, overlapping chunks, BM25 ranking, and cited extractive Q&A entirely in the visitor's browser. It does not use an LLM or vector embeddings. Files remain in session memory; reloading restores samples. Fonts load from Google Fonts.

## Develop

Requires Node.js. No dependencies to install.

```sh
npm start
npm test
```

Open http://127.0.0.1:4173 for local preview.

## Files

- `dist/index.html`: portfolio and interface
- `dist/style.css`: responsive styling
- `dist/engine.js`: chunking, tokenization, BM25, extraction, sample evaluation
- `dist/app.js`: uploads, controls, citations, query trace export
- `tests.mjs`: retrieval smoke tests

## Deploy

GitHub Pages publishes `dist` via `.github/workflows/pages.yml` on pushes to `main`. Pages uses GitHub Actions as its build source. Local edits need to be committed and pushed to become live.

The UI supports UTF-8 .txt/.md files, up to 2 MiB per file, 20 documents and 8 MiB per session. Retrieval matches terms rather than meaning; a positive score is not confidence. The bundled evaluation is a small deterministic smoke suite, not a production quality benchmark.
