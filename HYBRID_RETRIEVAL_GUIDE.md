# Hybrid retrieval and measured comparison

## Use hybrid search

Open https://codesensitive.github.io/. In **Search & models**, choose **Hybrid · BM25 + BGE** or **Hybrid · BM25 + MiniLM**, then click **Download & activate locally**. Hybrid mode uses the chosen local embedding model; it does not download another model for fusion.

The app runs BM25 and semantic retrieval on the same current chunks. Each returns up to 20 candidate chunks; semantic candidates must pass the existing model-specific cosine cutoff. Reciprocal Rank Fusion (RRF) merges the lists:

```text
RRF(chunk) = sum of 1 / (60 + rank) across lists containing that chunk
```

Ranks start at 1. A passage retrieved by both methods receives a contribution from each. A passage present in just one list remains eligible. Each chunk appears once in the fused list. Ties are resolved deterministically. Raw BM25 and cosine scores are retained for inspection but are not averaged or directly compared.

The UI returns the selected top 2, 3 or 5 fused chunks as extractive evidence. Citations preserve PDF page numbers and OCR flags. Expand a source to see its RRF score, BM25 rank, semantic rank, and original component scores. Query trace JSON includes those values, the actual embedding model, candidate depth, cosine cutoff, and RRF constant.

Changing documents, chunk size, or embedding model rebuilds the appropriate vectors before querying. Hybrid mode retains the existing 200-chunk local inference limit. BM25-only mode remains available without a model download. Hybrid does not add an LLM or a reranker, and a high RRF score is not evidence of factual correctness or answerability.

## Compare retrieval methods

Click **Compare retrieval** in the workspace toolbar. This can download MiniLM and BGE weights (approximately 57 MB combined), plus the local inference runtime if not already cached. It runs real local inference; the table is not populated with hard-coded scores. You can cancel a running comparison with **Cancel model operation**. Failed/cancelled runs do not display partial metrics.

The comparison uses the fixed `engineering-v1` dataset in `dist/benchmark.js`, independent of the uploaded corpus, active retrieval mode, and chunk settings:

- Eight synthetic source documents, chunked at 120 words.
- Twelve answerable queries covering technical identifiers, paraphrases, factual questions, and one query with two labeled relevant sources.
- Three questions with no labeled relevant source.
- Four methods: BM25, MiniLM, BGE, and Hybrid BM25 + BGE.
- Top-three result evaluation for all methods; hybrid uses up to 20 candidates per input list and RRF constant 60.

The same queries, corpus, labels, cutoffs and top-K are used for each method. Both embedding models run with the existing quantized browser settings. Hybrid reuses the BGE query results from the same run, so it does not silently compare a different model or retrieval threshold. The active user corpus is preserved; its vector index is restored/rebuilt on the next query if required.

## Reading the metrics

| Metric | Meaning | Direction |
| --- | --- | --- |
| Hit@1 | Fraction of answerable queries whose first result is a labeled relevant source | Higher is better |
| Recall@3 | Average fraction of labeled relevant source documents found within the first three results | Higher is better |
| MRR@3 | Mean reciprocal rank of the first relevant result, or zero when none is found in the first three | Higher is better |
| False evidence | Fraction of labeled unanswerable queries for which the method returned any passage | Lower is better |

Recall counts unique relevant source documents, so overlapping chunks from one file cannot count as multiple relevant files. Answerable and unanswerable queries use separate denominators. The report does not represent generated-answer accuracy, an LLM hallucination rate, or a latency benchmark.

Expand **Inspect all labeled questions and rankings** to see every query, its relevant source IDs and the actual ranked files for each method. **Download comparison JSON** exports the dataset, settings, per-query results, raw scores and aggregated metrics for reproducibility. No uploaded private documents are included in that comparison export.

## Interpreting results responsibly

This is a small synthetic dataset authored for the application, not a held-out benchmark or a universal model leaderboard. Cutoffs and ranking choices can affect results. Hybrid can recover exact identifiers that a vector model misses, but lexical matches can also introduce false evidence. It is acceptable for a standalone embedding model to outperform hybrid on some metrics. The interface reports the measured scores without declaring a universal winner.

To evaluate your actual use case, replace or extend `benchmarkDocuments` and `benchmarkQueries` with representative source passages, exact-term questions, paraphrases and genuinely unsupported questions. Label relevant source IDs before inspecting rankings. Keep development/tuning questions separate from a held-out test set. Increase corpus diversity before drawing broader conclusions.

## Files and tests

- `dist/retrieval.js`: retrieval-mode routing, RRF, per-query metrics, aggregation.
- `dist/benchmark.js`: labeled dataset and real comparison runner.
- `dist/app.js`: activation, query fusion, explanations, comparison table and JSON download.
- `tests.mjs`: RRF agreement, raw-score scale independence, duplicate prevention, source-level recall, MRR and no-answer denominator checks, plus the previous PDF/OCR/embedding tests.

The existing **Run smoke test** button still performs its five deterministic BM25 sample checks. It is distinct from **Compare retrieval**. The automated Node tests validate implementation behavior; the actual four-model comparison is also exercised in the browser with real downloaded model weights.
