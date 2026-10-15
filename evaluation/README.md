# Engineering-v1: observed browser comparison

Measured with the actual quantized MiniLM and BGE models in the browser on 15 October 2026. The complete run, including all labels and rankings, is in `engineering-v1-browser.json`.

The dataset contains eight synthetic documents, twelve answerable questions and three unanswerable questions. One answerable question requires two relevant sources. All methods are evaluated at top 3.

| Method | Hit@1 | Recall@3 | MRR@3 | False evidence on 3 no-answer queries |
| --- | --- | --- | --- | --- |
| BM25 | 66.7% | 66.7% | 0.667 | 33.3% |
| MiniLM | 100.0% | 95.8% | 1.000 | 0.0% |
| BGE Small | 91.7% | 95.8% | 0.958 | 33.3% |
| Hybrid BM25 + BGE | 91.7% | 100.0% | 0.958 | 33.3% |

On this run, hybrid found all labeled sources in its top three results, while MiniLM had better first-result ranking and no-answer filtering. There is no universal winner demonstrated here. In particular, 33.3% false evidence represents one case out of only three; it is not a population estimate or a generated-answer hallucination rate.

These are observed numbers, not target assertions in the test suite. The interface computes a fresh comparison when a visitor clicks Compare retrieval. It does not load this saved report to populate the table.

This authored dataset is not held out, and the default similarity thresholds are heuristics. Broader model selection needs representative real documents and independently labeled test questions. Model weights are loaded from their named Hugging Face repositories and can be affected by upstream revisions or browser caches.
