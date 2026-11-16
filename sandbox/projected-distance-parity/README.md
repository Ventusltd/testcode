# Projected-distance precision experiment

This is bounded TestCode, not a replacement grid engine or benchmark framework.
Synthetic projected XY coordinates are expressed in metres. There are no real
sites, projections, electrical connections, headroom or routing claims.

The committed arithmetic reference is [grid-distance-maths geodesy.py at
8e91b07](https://github.com/Ventusltd/grid-distance-maths/blob/8e91b07d8312acca5bcaef43e839f06a3b1d642a/src/geodesy.py),
whose local-plane segment projection subtracts coordinates before forming
`dx*dx + dy*dy`. `pins.json` records its exact blob/SHA256, verified from committed
bytes before implementation. Only that norm primitive is adapted here; this
does not reproduce the owner's full geodesic/segment/index search contract.
No owner module is copied or executed. The independently evaluated scalar
reference uses `math.hypot` per query/candidate and strict first-index tie order.

The existing GPU owner's engine/fused and worlds paired-channel/restart lessons
informed the bounded resident-array, compact-output, synchronization and counted
coverage design. The locally inspected `engine/gridatlas_gpu/sweep.py` was
untracked adjacent work and was **not** attributed to its repository HEAD or
copied. HELMUT VOGEL owns Kuiper/worlds4590; FURNACE owns its experiment programme.
This probe adds no scheduler, worker service, model or GPU configuration change.

## Run

Requires the existing Python/NumPy environment; CuPy is optional and imported
only with `--gpu`. No dependency installation is performed by the script.

```text
python -B -m unittest discover -s sandbox/projected-distance-parity -p test_probe.py -v
python -B sandbox/projected-distance-parity/probe.py
python -B sandbox/projected-distance-parity/probe.py --gpu --out NEW-RECEIPT.json
```

Coordinate GPU use with HELMUT/FURNACE and obey the current shared device/job
controls before `--gpu`. This script grants no lease. Observe other work without
killing it. If no compatible slot is established, retain CPU output with GPU
NOT_REQUESTED; unavailable/deferred GPU returns exit2, never PASS. Output is
exclusive-create and contains no private paths, process IDs or input page bodies.
No receipt should be published until its stated source/coverage is reviewed.

Default size is128queries x256candidates (32,768distinct pairs); hard ceiling
512x1024. All nearest identities have a complete scalar witness. Float64 inputs
must already preserve their precision: casting previously quantized float32 to
float64 cannot recover centimetres. NaN/Inf, empty, over-budget, non-Nx2 and
unbounded inputs reject before GPU allocation. Exact ties select the first
candidate array index; nearby unequal distances are not collapsed with isclose.
Comparison tolerance is1e-10absolute plus1e-12relative in **squared metres**, never
scaled by the absolute coordinate offset. Nearest indices must match exactly.

Five boundary fixtures cover large-offset cancellation, centimetre input loss,
negative cancellation, exact ties and nearby unequal distances. A deliberately
bad float32 norm/dot identity is a counterexample, not a candidate implementation.
Its precise wrong bits are backend-sensitive; report measured rejection rather
than assuming every CPU/GPU instruction sequence fails identically. Independent
planted wrong-ID/distance/nonfinite tests ensure the comparison can fail.

The GPU process uses device0 and checks >=128MiB free before limiting its own
CuPy pool to64MiB. CUDA context/compiler overhead is outside that allocator limit;
this is not a global VRAM quota. There is no installation, process termination,
device reset, clock change or external job control. A shared card is always
labelled nonexclusive. Three resident repeats and three transfer-inclusive repeats
are distinguished from32,768distinct inputs; repetitions are not new coverage.
Receipts report scalar, NumPy first/warm, GPU upload, first kernel/compile,
download, resident warm and transfer-inclusive warm times plus actual versions.
GPU import/context and complete validation appear in a separate cold end-to-end
interval. A small shared-device run cannot establish production throughput,
energy efficiency or a whole-application speedup. Keep CPU if this task is slower.

The source/runtime versions and actual output belong in each generated receipt.
Unit-test PASS is offline correctness evidence, not GPU execution evidence.

## Actual bounded observation, 16 November 2026

One local128x256 run completed in3.06seconds, under a30second child-process
timeout. All128 GPU nearest IDs/distances matched the complete scalar witness;
all five float64 boundary fixtures passed. The deliberately bad float32
expression changed127of128 NumPy nearest IDs and was rejected on both backends
for the offset, centimetre-loss, negative-cancellation and near-tie fixtures.
The exact-tie fixture correctly did not imply every bad formula must always fail.

Device was NVIDIA RTX5070Ti, observed driver610.88, CuPy14.2.0,
CUDA runtime12090/driverAPI13030, Python3.12.10 and NumPy2.4.6. The card was
shared, not reserved/exclusive. A CUDA_PATH discovery warning was emitted but
actual computation succeeded; no environment repair or installation was needed.
The existing Furnace hourly task was Ready, not running at the bounded check;
no universal device lease API was established in the inspected owner files.
Coordination proposals were posted before compute; no owner ACK is inferred.

| Measurement | Milliseconds |
| --- | ---: |
| Complete scalar witness | 15.2111 |
| NumPy first / warm median | 0.3920 / 0.4062 |
| GPU upload / download | 0.9853 / 0.1243 |
| GPU first kernel plus compile | 2459.5435 |
| GPU resident warm median, three repeats | 0.1926 |
| GPU transfer-inclusive warm median, three repeats | 0.3201 |
| GPU cold setup plus full validation | 3031.1346 |

Cold one-shot GPU was clearly slower at this size. Warm timings do not establish
a robust acceleration result from only three shared-device repeats. This fixture
finds a precision hazard and preserves CPU as a practical small-workload choice;
it is not a ceiling on larger GPU workloads. Input SHA256:
`d44dfe6b86ac2c80e038a0ede5b1e4dd9050c147fbda1ac0795b2b22bda5f953`.
Executed probe SHA256:
`cb086bec9c1aaaf9354b3f7315d7e0d97cd81dc2047f5d2258de9f44d3d90997`.
The twelve offline tests passed separately. No hosted GPU/CI or production claim.
