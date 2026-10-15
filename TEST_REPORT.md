# PDF upload and Q&A verification

> **Hybrid update:** The current version adds BM25 + MiniLM/BGE RRF fusion and a real labeled four-method retrieval comparison with per-query inspection and JSON export. The automated suite now has 23 passing checks, including rank fusion and evaluation metric regressions. See `HYBRID_RETRIEVAL_GUIDE.md`; the older version-specific counts and scope statements below are historical.

> **Embedding/OCR update:** The current version adds MiniLM/BGE model switching, local vector retrieval, model caching/download links and optional English OCR for scanned PDFs/images. The 17 automated tests pass, including actual OCR of a synthetic scanned image. Local browser tests verified both model activations, a synonym-style vehicle query, corpus reindexing, OCR recognition of a scanned PDF, and its page citation. The older PDF-only scope statement below records the previous version; current limitations are in `SEMANTIC_OCR_GUIDE.md`.

Date: 15 October 2026 (India time).

## Reproduced issues

- The live portfolio rejected PDF files with `use .txt or .md`.
- Sentence extraction split decimal values such as `42.5` at the decimal point.
- The existing file-size accounting mixed compressed file bytes and decoded text bytes; the PDF path now enforces corpus limits on extracted text.
- The upload control was a label tied to a hidden input. It is now a keyboard-accessible button, disabled while parsing.

## Fixes

- Local PDF.js extraction with a pinned, self-hosted runtime and worker (no document service).
- PDF page numbers preserved through indexing, citations and trace exports; chunks never span pages.
- Errors for damaged, locked, textless, oversized and over-100-page PDFs; a 30-second parsing limit.
- A batch continues processing valid files after rejecting invalid ones.
- Controls disabled while reading; restored in cleanup after success or failure.
- Decimal-safe sentence boundaries and correct singular/plural passage labels.
- GitHub Actions runs tests before publishing static assets.
- First-party JavaScript, module imports and stylesheet URLs are versioned to prevent older cached assets from mixing with the PDF interface.

## Automated checks

`npm test`: 13/13 passing locally. Checks cover the existing sample evaluation, uploaded text retrieval, chunk overlap, empty queries, literal markup excerpts, real two-page PDF extraction and retrieval, page boundaries, decimal preservation, textless PDFs, encrypted PDFs, corrupt PDFs, page limits and text/file validation. The test runner's PDF font resources were also corrected for Windows filesystem paths.

`npm audit --omit=dev`: no vulnerabilities reported at verification time. JavaScript syntax checks pass.

## Browser checks on local preview

| Action | Observed result |
| --- | --- |
| Upload `project-brief.pdf` through the file chooser | Added as one document with two pages |
| Ask the project codename | Marigold, cited to page 1 |
| Ask the launch date | 21 November 2026, cited to page 2 |
| Open page 2 citation | Expanded the correct page's text |
| Download query trace | JSON contains page 2, its source text and the selected excerpt |
| Ask the latency target | Full `42.5 milliseconds` value retained |
| Upload damaged, locked and no-text PDFs with a valid TXT | Specific errors for each invalid PDF; TXT still added |
| Query the valid TXT after failed PDFs | Correct rollback contact retrieved |
| Change chunk size to 60 and top K to 2 | PDF answer retained with correct page citation |
| Remove the PDF and search its unique codename | No matching evidence |
| Restore samples and run evaluation | 5/5 sample checks passed |
| Remove all documents and submit | Add/restore document guidance displayed |
| Inspect browser warnings/errors | No captured errors during the successful local upload flow |

Fixtures contain synthetic project facts, not claims about real work. The fixture preview was rendered and inspected for readable text. Trace downloads contain source content and are initiated by the visitor.

## Scope

This remains lexical extractive Q&A, without an LLM. It does not perform OCR. Image-only and password-protected PDFs require an unlocked, text-based version. Complex PDF layouts can have imperfect extraction order. The smoke tests do not establish general answer correctness or production-scale performance.

Production browser verification is performed after deployment; its result is recorded in the task handoff.

## WebLLM generation — 2026-10-15

- Automated: 29/29 tests pass, including existing PDF/OCR/retrieval regressions plus six WebLLM catalog, prompt, citation and client tests. npm audit reports zero vulnerabilities.
- Catalog: all four selected IDs verified against pinned WebLLM 0.2.86. Upstream MLC ndarray shard sizes and WebLLM GPU estimates independently checked using scripts/verify-llm-catalog.mjs.
- Real browser/WebGPU: SmolLM2 135M f16 downloaded and initialized. Uploaded the two-page synthetic project-brief.pdf and asked the launch date. Output correctly included 21 November 2026. No citation emitted; missing-citation notice appeared.
- Switched to Qwen2.5 0.5B q4f32. Download progress displayed, initialization completed and the same PDF question returned the correct date. No citation emitted; notice appeared. Exported query trace recorded actual model ID, page-2 context, complete answer, token usage (172 input / 15 output), completion timing and missing-citation check.
- Query with no BM25 matches showed no-evidence response and did not generate. Load cancellation restored enabled controls and evidence-only mode. Selected Qwen cache removal completed successfully.
- Llama 3B and Qwen 1.5B are catalog/manifest validated; they were not downloaded or generation-tested in this run. No cross-model answer-accuracy benchmark is claimed. WebGPU-unavailable and GPU-out-of-memory behavior are handled with errors/fallback, but were not reproduced on this compatible test GPU.

## Simple / Advanced experience — 2026-10-15

- 30/30 automated tests pass, including a check that Simple chooses its fixed defaults without mutating Advanced configuration.
- Browser: Simple is selected initially, corpus is empty, upload/question controls are visible, and model/retrieval/evaluation controls are hidden.
- Uploaded project-brief.pdf in Simple and asked the launch date without choosing a strategy or model. Automatic hybrid BM25+MiniLM retrieval plus Qwen2.5 0.5B returned 21 November 2026 with page-2 source evidence. Missing model citations remained visibly flagged.
- Switching to Advanced revealed all controls while preserving the uploaded PDF and question. Changed chunk size to 240 and top-k to 5, switched to Simple and back: both Advanced values were retained. Keyboard ArrowLeft switched to Simple.
- Cancelled a Simple generation: controls returned, documents and retrieved evidence remained visible, incomplete output was discarded.
- Uploaded scanned-note.png in Simple with no OCR toggle; automatic English OCR extracted its text and recorded OCR provenance.
Deployment also generates content-hashed app/style entry files, preventing a cached previous entry script from initializing the new mode interface.


Full-system audit (2026-10-15): 63 tests passed; zero reported dependency vulnerabilities. See AUDIT_REPORT.md for fixed defects, actual browser checks and controlled failure-test boundaries.
