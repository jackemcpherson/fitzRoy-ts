# Version 5 Migration Guide

Version 5 preserves Brisbane Bears and Brisbane Lions as distinct historical
club identities. Consumers that keyed both clubs as Brisbane Lions must update
their joins and stored mappings before ingesting historical rows. Fitzroy stays
separate. Rating continuity is a downstream policy, not a source identity.

Existing match request shapes remain unchanged. Coaching is opt-in through
`fetchMatchCoaches`, with AFL Tables as the default for AFLM from 1990.
Use the completeness envelope and continuation cursor before treating a season
as complete. FootyWire season-wide coaching remains unsupported.

Install `fitzroy@5.0.0`. Reconcile existing historical records by stable provider
match IDs. Review an identity repair before writing it. Preserve match IDs and issued
prediction snapshots. AFL-MCP performs this repair
through its authenticated operator surface after the compatible Worker deploys.
