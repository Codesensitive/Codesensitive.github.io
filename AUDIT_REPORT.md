# End-to-end audit — 15 October 2026

Live: https://codesensitive.github.io/ · Source: https://github.com/Codesensitive/Codesensitive.github.io

## Scope

Reviewed all first-party application modules, HTML/CSS, ingestion, OCR, retrieval, evaluation, model workers, prompting, cache controls, build scripts, preview server and Pages workflow. The codebase-memory index excluded dist/ and scripts/, so these files were read directly. Third-party implementations were checked through pinned dependencies, runtime integration and npm audit, rather than an exhaustive vendor-source security review.

The original 30 tests passed before changes. The expanded suite has **63 passing tests**, combining existing regressions, application integration with a DOM emulator and controlled workers, and resource/prompt/build tests. Real-browser checks separately exercised PDF.js, Tesseract, MiniLM, BGE and GPU WebLLM inference.

## Fixed findings

| Area | Defect | Resolution |
|---|---|---|
| Mode isolation | A Simple-loaded LLM generated in Advanced even when Advanced was configured for evidence only. | Separate configured answer mode from the worker's loaded model. |
| Model selection | Simple replaced the model needed by an activated Advanced choice; failed replacements discarded previous configuration. | Preserve Advanced choices and reload as needed; retain previous configuration on failure/cancellation. |
| Sample loading | Trying samples replaced uploads. | Merge samples without duplicates; enforce document and text-byte limits. |
| Upload cancellation | Ingestion/OCR batches could not be stopped. | Abort controls in both modes stop remaining files and preserve accepted documents. |
| Deadlines | Runtime loading, file reads and initialization were outside the PDF timeout. | Apply a whole-document deadline and propagate cancellation through asynchronous stages. |
| OCR recovery | Cancelled/late initialization could continue progress or retain an initialized worker. | Suppress late progress; terminate ready and late-initializing workers once available. |
| Image allocation | Pixel limits were checked after decoding. | Validate PNG/JPEG dimensions before decoding pixels. |
| Image OCR | Transparent backgrounds were passed directly to OCR; temporary canvas resources lingered. | Composite onto white and release canvas/bitmap resources. |
| PDF allocation | Full page text was joined before its byte budget was checked. | Check item bytes before allocating joined page text. |
| Worker lifecycle | A late error from an old worker could interrupt its replacement. | Ignore events from workers that no longer own the client. |
| Worker requests | Failed sends left pending timers; embedding operations could overlap shared state. | Serialize requests and clean up startup/send/message failures immediately. |
| Context selection | Prefix truncation discarded relevant text near the end of a chunk. | Select question-relevant source windows within the input budget. |
| Unicode/budgeting | Non-ASCII questions were silently shortened; escaped metadata could prevent context trimming from terminating. | Preserve UI-sized Unicode questions, record truncation, sanitize metadata and guard the loop. |
| Answer display | A real mixed-document test produced an uncited wrong launch date from an inspection source. | Display exact source excerpts when generated citations are missing/out of range; keep raw and displayed outputs separate in traces. |
| Duplicate evidence | Identical PDF/image passages repeated distractor context and occupied result slots. | Deduplicate normalized passage text before final top-k selection. |
| Trace coverage | No-hit queries had no trace export; automatic model-load failures were absent from generation metadata. | Export empty results and record failed/cancelled model loads. |
| Cache independence | Clearing another answer model unloaded the active model; embedding cache deletion could race new work. | Preserve unrelated loaded models and serialize cache changes. |
| Deployment caching | Imported modules and worker files were not fingerprinted. | Hash the complete first-party module/worker graph and rewrite its relative references. |
| Local/deployed builds | Local start could serve old generated files; the PDF runtime could drift from installed dependencies. | Prepare assets before start and rebuild PDF/AI resources from pinned packages during deployment. |
| Layout | Long URLs/unbroken source text could be clipped. | Wrap source/excerpt/status text and allow document flex items to shrink. |

## Verification

- `npm test`: **63 passed**. Coverage includes PDF citations, real English OCR recognition, mode isolation, worker failures/races, cancellation, deadlines, 20-document/8 MiB limits, >200-chunk fallback, Unicode/context budgets, citation fallback, inert markup, comparison cancellation, empty-result traces and dependency-hash propagation.
- `npm audit`: **zero reported vulnerabilities** across installed dependencies at audit time.
- Actual mixed upload: valid PDF, scanned PDF and PNG accepted; damaged and locked PDFs rejected independently with clear errors. OCR provenance retained.
- Actual OCR-batch cancellation preserved existing documents and restored enabled controls.
- Actual mixed-document question initially returned inspection date 18 December 2026 as the launch date, without citations. After the fix, the display used attributed source excerpts containing launch date **21 November 2026**, with duplicate scan text suppressed.
- Actual Advanced evidence-only query after Simple generation had no generated-answer section.
- MiniLM, BGE and hybrid-BGE matched the automobile/gasoline passage for “What powers the car?”.
- Browser smoke suite: **5/5**. Full real-model comparison completed with the prior saved results. Uploaded documents and selected strategy remained usable afterward.
- An actual no-match query downloaded a version-6 JSON trace with empty results and effective settings.
- Clearing a different answer model's cache preserved the loaded small model; the next Simple generation completed.
- At a 390px viewport, both modes had no horizontal page overflow. A 2,200-character URL wrapped in excerpts and expanded sources without internal horizontal overflow. The viewport was restored afterward.

## Boundaries

Citation numbers do not establish factual entailment. A model can still make a wrong claim with a valid citation. Source-excerpt fallback can retrieve irrelevant text. The app does not guarantee hallucination-free answers or immunity to instructions embedded in documents. OCR and complex PDF reading order remain imperfect.

This audit physically exercised a compatible GPU with Qwen 0.5B; earlier validation also exercised SmolLM2. The two larger LLM choices were not downloaded during this audit. Missing-WebGPU, allocation/network failures, stuck work and worker races are tested with controlled doubles, not every physical browser/GPU combination. Browser cache eviction, model-host availability and already-open historic versions remain environmental limits.

This is a bounded audit of the current application, not a guarantee that no possible defects remain. GitHub Pages publishes the tested artifact through the existing workflow; the final public smoke check is recorded in the completion and local audit log.
# Progress presentation follow-up

All long-running operations now use a separate sticky card above the lab: uploads/OCR, embeddings, WebLLM loading and generation, cache clearing, and retrieval comparisons. It scrolls into view when work begins and disappears when work finishes. Measurable percentages are explicitly labeled as current-stage progress; other stages use an indeterminate indicator. Cancellation is shared across operations. Sidebar labels retain the active configuration. The updated suite passes 65 tests; desktop and mobile model-loading cards were checked in the browser.

