# comparison/ — archived parity & benchmark harness

Point-in-time harness (2026) comparing fitzRoy-ts output and performance
against the R fitzRoy package. **Not maintained**: it is not typechecked,
linted, or run in CI, and may not compile against the current library API.
The parity conclusions it produced live in `docs/R_PARITY.md`.

If you want to revive it: add it to a tsconfig project and an npm script so
it stays honest, or treat it as a reference for writing a fresh harness.
