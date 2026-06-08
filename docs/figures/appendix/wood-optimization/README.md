| Image name           | Max iterations | Population size | Mutation rate | Output size | Purpose                                                               | Similarity |
| -------------------- | -------------: | --------------: | ------------: | ----------: | --------------------------------------------------------------------- | ---------- |
| `wood-fast-preview`  |             50 |              10 |          0.20 |         128 | Fast test, shows whether the optimizer improves quickly               | 86.9%      |
| `wood-balanced`      |            150 |              15 |          0.15 |         128 | Main config for thesis, good runtime/result trade-off                 | 86.5%      |
| `wood-high-search`   |            300 |              25 |          0.20 |         128 | Tests whether more search effort improves the result                  | 86.7%      |
| `wood-high-mutation` |            150 |              15 |          0.35 |         128 | Tests whether stronger exploration helps or becomes unstable          | 91.2%      |
| `wood-low-mutation`  |            150 |              15 |          0.05 |         128 | Tests whether conservative search converges too slowly                | 91.4%      |
| `wood-quality-256`   |            150 |              15 |          0.15 |         256 | Tests effect of higher output resolution on runtime and approximation | 90.0%      |
