# Vendored Pyodide runtime

Source: https://github.com/pyodide/pyodide (Apache-2.0). Core runtime files
only (`pyodide.asm.js`, `pyodide.asm.wasm`, `pyodide.mjs`,
`pyodide-lock.json`, `python_stdlib.zip`) — no third-party Python wheels are
vendored because the only script this runtime executes
(`stagedjson_to_inputxml.py`, see
`../stagedjson-to-inputxml-scripts/`) uses nothing beyond the Python
standard library.

Used by `src/core/geometry/adapters/stagedjson-to-inputxml-worker.js` to run
the real, already-validated StagedJSON -> CAESAR II InputXML converter
in-browser, inside a Web Worker, loaded lazily only when a user selects a
StagedJSON input in the F LFEA pipeline. Not loaded on app boot.
