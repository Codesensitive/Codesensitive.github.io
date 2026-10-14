# Local embedding models and OCR

## Using the website

Open https://codesensitive.github.io/ and find **Search & models** in Evidence Lab's knowledge-base panel.

1. Choose BM25, MiniLM L6 v2, or BGE Small English v1.5.
2. Click **Download & activate locally** for an embedding model. The button fetches model files and creates the local index; it does not send your documents to an inference API. BM25 uses **Activate BM25** and needs no weights.
3. Wait for the Active status, then ask your question. A Cancel button is available while a model operation runs.
4. Add/remove documents or change chunk size normally. The next semantic query rebuilds vectors for the current corpus. Switching models rebuilds all vectors in the chosen embedding space.
5. Open citations to inspect evidence and scores. Download query trace records the actual model, cutoff, passages, page numbers and OCR flags.

## Available models

| Choice | Approximate quantized weights | Dimensions | Pooling | Purpose |
| --- | --- | --- | --- | --- |
| BM25 | None | Not applicable | Not applicable | Immediate exact-term retrieval |
| MiniLM L6 v2 | 23 MB | 384 | Mean | Small English sentence-embedding baseline |
| BGE Small English v1.5 | 34 MB | 384 | CLS | English passage retrieval; uses its retrieval query instruction |

The model menu provides a model-card link and **Download ONNX weights** for an explicit file download. Activating a model downloads it into the runtime/browser cache; downloading the ONNX file alone does not install it into the app. Standalone ONNX files also need their tokenizer/configuration and an inference runtime for use elsewhere.

The runtime adds roughly 27 MB of WASM plus JavaScript to first-use embedding downloads. Only model resources are fetched from Hugging Face. The JavaScript/WASM runtime is served with this site. The browser may retain weights in a site-specific Cache API cache; retention depends on browser storage policy. Reloading still resets documents, vectors and the active model to BM25. **Clear downloaded model cache** releases the worker/vectors, clears this app's embedding cache and restores BM25. It does not clear the separate OCR language cache.

These are practical compact options for this browser application, not a claim that they are the best models across all retrieval benchmarks. Both choices here target English. MiniLM inputs are limited to 256 tokens and BGE inputs to 512 tokens. Longer chunks are truncated for embedding; citations still show the full chunk. Smaller chunks are usually easier to inspect.

Semantic retrieval is limited to 200 chunks per session for responsiveness. The worker uses CPU/WASM with one thread so it can run on static hosting without cross-origin isolation or a GPU. No vector database or paid API is required.

Cosine cutoffs are 0.25 for MiniLM and 0.5 for BGE. These are practical heuristics; a retrieved result is not proof that a question is answerable, and a filtered result can still contain relevant information. Semantic mode presents complete retrieved chunks to avoid selecting a misleading sentence solely by exact keyword overlap. It does not generate an explanation.

## Google Embedding 2

Google documents **Gemini Embedding 2** through the Gemini API. This app does not offer it as downloadable browser weights or imply that its hosted API is a free local model. No Gemini API key is requested or embedded in the site. A future hosted provider integration would require a separate decision about credentials, privacy and usage costs.

## Scanned PDFs and images

Enable **English OCR for scans/images**, then add a scanned PDF, PNG or JPEG. PDF.js renders each PDF page lacking selectable text into a bounded-size canvas; Tesseract.js recognizes its English text locally. Images use the same OCR engine directly. OCR is opt-in because it adds processing time and downloads runtime/language resources. The English trained data is approximately 3 MB; engine files add to this.

Text PDFs support up to 100 pages, while OCR processes at most 10 textless pages per PDF. Inputs remain limited to 2 MiB per file, 20 documents and 8 MiB of extracted text. PNG/JPEG inputs are limited to 16 megapixels and resized to a maximum 2400-pixel edge. PDF rendering is likewise bounded. Each OCR worker has a 120-second deadline; PDF processing also has a timeout. An error restores controls and other files in a batch can continue.

OCR provenance is displayed in the document list and PDF source locations, and retained in trace exports. Recognition can misread names, numbers, handwriting, tables, columns and low-quality scans. Inspect the extracted text. A page that already has selectable text is not OCR'd, so image text elsewhere on such a mixed page may be missed. Password-protected PDFs still require an unlocked copy. This is not a document-layout understanding model.

## Microsoft tools

PowerToys Text Extractor is a Windows desktop utility, rather than a browser library available to a public static website. A user can extract text with it manually and save a TXT file for upload. Power Automate/AI Builder is a separate Microsoft service with its own access and licensing considerations. The current site uses local Tesseract OCR and requires no Microsoft connection.

## Sources and reproducibility

- [MiniLM ONNX model card](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
- [BGE ONNX model card](https://huggingface.co/Xenova/bge-small-en-v1.5)
- [Original BGE model and retrieval instructions](https://huggingface.co/BAAI/bge-small-en-v1.5)
- [Transformers.js](https://huggingface.co/docs/transformers.js/)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [Gemini Embedding 2](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2)
- [PowerToys Text Extractor](https://learn.microsoft.com/en-us/windows/powertoys/text-extractor)

Pinned runtime versions are in `package.json` and `package-lock.json`. Runtime assets are generated by `npm run prepare:ai` and `npm run prepare:pdf`; licenses are retained with the distributions. GitHub Actions runs `prepare:ai` before tests/publication. The compiled Transformers.js distribution is generated from its pinned npm package rather than tracked in Git. Run `npm run prepare:ai` after installing dependencies for local development. `npm test` includes PDF regression tests, cosine/dimension checks, model metadata checks, OCR opt-in validation and actual English OCR on a synthetic scanned image. Model downloads and browser worker inference are additionally verified through browser interaction, not mocked as an automated model-quality benchmark.
