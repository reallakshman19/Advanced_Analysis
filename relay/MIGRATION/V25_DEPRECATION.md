# Engineering Relay V2.5 deprecation notice

Status: **READ_ONLY_HISTORY**

Engineering Relay V3.1 is the selected relay protocol after the Owner-authorized V3 -> V3.1 bridge at 2026-09-22T15:49:04Z.

The preserved V2.5 tree remains at `agents/relay/**` with cutover digest:

```text
sha256:105fa2facbe20eee942eaa9e4cefbf8d2ede8e93351b9d846f5530be8eb2cef1
```

The prior V3 live objects were format-migrated with semantic preservation recorded in `relay/MIGRATION/V3_TO_V31_BRIDGE.yaml`.

The prior unfinished V3 lease is administratively released. No checkpoint or numerical PASS was created by migration, and issue #1862 remains unadmitted.
