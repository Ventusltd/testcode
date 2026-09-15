# Same peak. Different energy.

A public synthetic profile lab. It imports `exceedance` directly from `Ventusltd/ventus-grid-engine` at `d9cd18b0e2034325814924e6e4a0e958014f2748`, `engine/connection-capacity.js`. No engine implementation is copied. The module digest is recorded in `model.mjs` and checked before test execution and in browser response evidence.

Enter equal-duration interval-average active powers in **kW**, a caller-stated **kW** cap and interval **hours**. Output power stays kW and energy stays kWh. MVA is not accepted as an unstated substitute. The 20/42/36/20 MW illustrative case is explicitly represented as `[20000,42000,36000,20000]` kW; the source proof's smaller numeric array is a kW case despite its MW comments.

Default: 42,000 kW peak, 12,000 kW peak excess, 9,000 kWh above cap, 2/4 intervals, 59,000 kWh total and load factor 59/84. Spike and plateau: same 12,000 kW peak excess, respectively 6,000 and 48,000 kWh. This is an eightfold energy difference, not a cost estimate.

Zero is a valid profile value. A zero profile returns a NaN load factor in the source; the adapter preserves its meaning as a tagged undefined record, not null or 0%. Nonfinite unexpected outputs are refused. Sparse arrays, missing readings and invalid numeric inputs cannot become silent zero readings. One whole-profile source call plus one source call per interval supplies both the summary and interval-inspection records. Page-owned arithmetic only lays out charts, formats values and computes time labels.

No available connection capacity, battery sufficiency, dispatch, cost, reactive power, power flow, engineering certification or sub-interval peak is inferred. The source's broader battery-store/cost narrative is deliberately omitted. The Questions and Machine detail sections state role, inputs, outputs, source, known static caller and unestablished next connection.

Local verification: `node --test model.test.mjs`. Optional `ENGINE_FILE` must point to the exact source bytes; its SHA256 is still checked. Browser harness: `node browser-check.mjs` with exact Playwright dependency supplied by CI. It exercises four engine/layout cases, errors, source bytes, overflow, export, malformed data, zero profile, spike/plateau, reduced motion and module-unavailable refusal. Optional feature-detected WebMCP read/configure hooks are unverified in a supported native context.
