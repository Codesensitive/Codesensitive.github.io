# Local WebLLM generation

Live: https://codesensitive.github.io/ — hosted free on GitHub Pages. The entire app is static. No API key or inference server is involved.

## Use it

1. Add a PDF, text document, or image (enable OCR for scans).
2. Choose BM25, semantic, or hybrid retrieval under Search & models.
3. Under Generate answers / WebLLM, choose an answer model. The dropdown shows weight download size and capability guidance; the description shows estimated GPU memory.
4. Click Download & load answer model. Wait for the active-model message, then submit a question.
5. Inspect the generated answer and numbered source passages. Download query trace exports the retrieval results, actual generation model, supplied context, generation parameters, answer, citation-number checks, usage and timing.

Changing the dropdown only previews a model. Clicking load activates it. Unload releases the worker/GPU and returns to evidence-only mode. Clear selected answer model cache removes that model's cached artifacts. Cancellation terminates the worker and requires loading again; partial cached downloads may be reused.

## Model choices

| Model | Weight download | Estimated GPU memory | Intended trade-off |
|---|---:|---:|---|
| SmolLM2 135M f16 | 269 MB | 0.36 GB | Basic extraction; limited instruction following; requires shader-f16 |
| Qwen2.5 0.5B q4f32 | 278 MB | 1.06 GB | Lightweight short factual answers |
| Qwen2.5 1.5B q4f32 | 869 MB | 1.89 GB | Balanced starting point |
| Llama 3.2 3B q4f32 | 1.81 GB | 2.95 GB | Larger capacity; higher resource requirements |

These are decimal MB/GB. Weight sizes are sums of shard `nbytes` from the MLC model's `ndarray-cache.json`, checked on 2026-10-15. They exclude tokenizer, configuration and compiled WASM downloads. GPU estimates come from WebLLM 0.2.86's prebuilt catalog and exclude other browser/app memory. Run `node scripts/verify-llm-catalog.mjs` to verify sizes against upstream manifests. Capacity guidance is qualitative; this project has not benchmarked answer accuracy across these models. Larger parameter counts do not guarantee better grounded answers. SmolLM2 and Qwen use Apache 2.0; Llama uses its community license. Model cards are linked in the interface.

## Execution path

`app.js` retrieves passages using the existing BM25 / embedding / hybrid path. If no evidence is found, generation is skipped. If an answer model is loaded, `buildGroundedPrompt` packages up to five numbered source chunks and the question. Source text is limited to 1,800 UTF-8 bytes total before JSON overhead, with a 2,400-byte serialized context ceiling. This leaves room in the configured 4,096-token context window. Filenames and questions are bounded too. Truncated context is recorded and disclosed.

`llm.js` manages a dedicated module worker, operation IDs, progress, deadlines and cancellation. `llm-worker.js` checks WebGPU and shader-f16 when needed, loads a model with MLCEngine, resets conversation history for each question, and streams a chat completion at temperature 0 with a 256-token output cap. Models run on the visitor's GPU. The answer renders through textContent, never HTML. Numeric citations are checked for missing or out-of-range IDs. Failed checks display exact source excerpts instead of the model answer; an exact no-answer refusal is allowed. This does not establish factual entailment. Evidence stays visible if generation fails or is cancelled. A failed/cancelled generation discards partial output and returns to evidence-only mode.

A prompt instructs the model to treat documents as untrusted data and refuse unsupported questions. This is guidance, not a guarantee against hallucination or prompt injection. Retrieval may return irrelevant matches. Always inspect source text. Small models can ignore citation instructions. Generated answers can stop at the output cap, which the UI reports.

## Downloads, privacy and hardware

WebLLM 0.2.86 is pinned in package-lock.json. `npm run prepare:ai` copies its bundled browser runtime into the static deployment. Weights/config/tokenizers download from Hugging Face's mlc-ai repositories; compiled model WASM libraries download from the official MLC GitHub repository. Network requests reveal ordinary connection metadata and chosen model to those hosts. Document text and questions are passed only to local workers and are not sent to these hosts. Model artifacts can persist in the browser cache; uploaded documents and answers are held in session memory. Browser storage limits, private mode and cache eviction may require re-downloading. Offline use is not guaranteed; this is not an offline PWA.

Use HTTPS (or localhost) with a current browser supporting WebGPU and a compatible GPU/driver. A browser exposing WebGPU is not proof that enough GPU memory is available. Shader features, resource limits, device loss and allocation errors can prevent a model from loading. The app reports the error and retains evidence-only search. Load a smaller model if needed. No CPU fallback for generation is included. Embeddings still run through their separate WASM worker.

## Hosting and checks

GitHub Actions installs pinned dependencies, generates runtime assets, runs automated tests, then publishes dist via GitHub Pages on pushes to main. The generated WebLLM bundle is ignored in Git and recreated during deployment. Existing PDF, OCR and retrieval tests remain in place. New tests cover supported model IDs, bounded prompts, citation checks, worker completion/error and cancellation behavior. Browser validation is recorded in TEST_REPORT.md.

Official references: [WebLLM basic usage](https://webllm.mlc.ai/docs/user/basic_usage.html), [WebLLM source and model catalog](https://github.com/mlc-ai/web-llm), [MLC model repositories](https://huggingface.co/mlc-ai).

## Simple and Advanced modes

The live lab starts in Simple mode with an empty document list. Upload documents or choose Try sample documents, then ask a question. Simple automatically uses hybrid BM25 + MiniLM retrieval, 120-word chunks, top three passages, English OCR for scans and Qwen2.5 0.5B for local answers. The first question can download roughly 300 MB of weights plus runtimes. Downloads begin on asking, not on opening the page or selecting a tab. If embeddings fail or the corpus exceeds 200 chunks, Simple falls back to BM25. If WebGPU/model loading fails, source excerpts remain available with an explanatory message. Cancel operation stops model work and preserves documents.

Advanced exposes retrieval strategies, embedding and answer-model selection, OCR, chunk/top-k controls, smoke tests, labeled comparison and query trace export. Tab changes preserve the corpus, current question, displayed results and Advanced settings. Simple defaults do not overwrite Advanced choices; the shared worker may hold the automatically selected Qwen model, while Advanced preserves its separately activated answer configuration. Advanced evidence-only queries do not use that Simple model. Simple always returns to its own fixed retrieval/chunk/top-k defaults. No models are downloaded merely by switching modes. Tabs support arrow keys and Home/End, and switching is disabled while work is running.


The full-system audit added abortable uploads, whole-document deadlines, question-aware context windows, Unicode preservation, duplicate-passage suppression and version-6 traces. All first-party imports/workers are fingerprinted in dist/assets. See AUDIT_REPORT.md for findings and limitations.
