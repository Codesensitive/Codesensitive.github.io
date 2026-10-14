# PDF upload and Q&A verification

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
