# Bounded local GPU review controller

This is the audited controller from the 2026-09-14 one-hour experiment. Its hard deadline has expired; it cannot start new inference jobs. No model or runtime is bundled or installed by this code or CI. The local temporary model/runtime was removed by the independent cleanup job at 15:32:50 UTC.

The controller requires a successful prior GPU proof, at least 10 billion model VRAM bytes, a 3GiB VRAM reserve, 4GiB RAM reserve, a temperature below 82C, one active job, bounded source excerpts, a 90-second request timeout, and exact quoted source evidence. It assigns no command or publication tools to the model. Source validation does not establish that a finding is semantically correct: the lead reviewer must check each claim. An unsupported quote fails the job. The independent lifetime watchdog remains responsible for terminating the runtime; a per-request controller is not a substitute for a process cleanup watchdog.

CI runs adversarial evidence-validation controls without loading a model or calling a network service:

```
node --test tools/local-gpu-review/controller.test.mjs
```
