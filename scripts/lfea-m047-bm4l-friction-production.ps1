param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{40}$')]
  [string]$ExpectedHead,
  [string]$ArtifactsRoot = 'artifacts/bm4l-friction-stage2',
  [string]$XmlCompareUtilitiesPath = '',
  [switch]$SkipNpmCi,
  [switch]$SkipExtractorInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$COMMON = 'f4d49f2a47d970ae0abf913b537193e324556177'
$ZIP_GIT_BLOB = 'df119ae1b8272469b6204036ab1aff21e561dfb8'
$ZIP_SHA256 = '978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9'
$ACCDB_SHA256 = 'e21b0862851ea2bb6f20d55e4a3a94f501537b618b98dd46afa9f6777ee38d3c'
$ACCDB_BYTES = 5136384
$LOADCASE_GIT_BLOB = 'be62eeb08af26dddcd59146e21188c108c4600dd'
$MISC_GIT_BLOB = 'ef23d224925e4568185a360ecbe1ee62503f15ff'
$PROFILE = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json'
$EXTRACTOR_PROVIDER = 'XML_COMPARE_UTILITIES_MDB_READER_V1'
$XML_COMPARE_REPO = 'https://github.com/reallaksh19/XML_Compare_Utilities.git'
$XML_COMPARE_COMMIT = 'd83c62214b7a6486c17698225ea4e11bc3121cb6'
$XML_COMPARE_PARSER_BLOB = '2ea596b6e9fb65e386e5cbb256f4141ce7bb595b'
$MDB_READER_VERSION = '2.2.6'
$MDB_READER_REGISTRY = 'https://registry.npmjs.org/'
$MDB_READER_SOURCE_REPO = 'https://github.com/andipaetzold/mdb-reader'
$MDB_READER_SOURCE_TAG = 'v2.2.6'
$MDB_READER_SOURCE_COMMIT = '720c8da1ef779b332cc5c4df559489cf45fe60bc'
$MDB_READER_RUNTIME_POLICY = 'LOCAL_MDB_READER_ONLY_NO_CDN_FALLBACK'

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Required command '$Name' is unavailable." }
}
function Invoke-Checked([scriptblock]$Command, [string]$Description) {
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Description failed with exit code $LASTEXITCODE." }
}
function File-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Git-Blob-Sha1([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path))
  $header = [System.Text.Encoding]::UTF8.GetBytes("blob $($bytes.Length)`0")
  $payload = [byte[]]::new($header.Length + $bytes.Length)
  [Array]::Copy($header, 0, $payload, 0, $header.Length)
  [Array]::Copy($bytes, 0, $payload, $header.Length, $bytes.Length)
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try { return ([BitConverter]::ToString($sha1.ComputeHash($payload))).Replace('-', '').ToLowerInvariant() }
  finally { $sha1.Dispose() }
}
function Assert-Git-Blob([string]$Path, [string]$Expected, [string]$Label) {
  $actual = Git-Blob-Sha1 $Path
  if ($actual -ne $Expected) { throw "$Label git-blob mismatch: $actual != $Expected" }
}

if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PowerShell 7+ is required.' }
'git','node','npm' | ForEach-Object { Require-Command $_ }
$repoRoot = (& git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Run from an Advanced_Analysis checkout.' }
Set-Location $repoRoot
$head = (& git rev-parse HEAD).Trim().ToLowerInvariant()
if ($head -ne $ExpectedHead.ToLowerInvariant()) { throw "Exact-head mismatch: $head != $ExpectedHead" }
$dirty = (& git status --porcelain=v1 --untracked-files=all | Out-String).Trim()
if ($dirty) { throw "Qualification requires a clean worktree.`n$dirty" }
$nodeVersion = (& node -p 'process.versions.node').Trim()
if ([int]$nodeVersion.Split('.')[0] -ne 22) { throw "Node 22 is required; found $nodeVersion." }
if (-not $SkipNpmCi) { Invoke-Checked { npm ci } 'npm ci' }

$artifacts = Join-Path $repoRoot $ArtifactsRoot
$sourceDir = Join-Path $artifacts 'source'
$xmlCompareCheckout = Join-Path $artifacts 'xml-compare-extractor'
$readerRuntime = Join-Path $artifacts 'mdb-reader-runtime'
New-Item -ItemType Directory -Force -Path $artifacts, $sourceDir | Out-Null

@(
  'src/core/fea-benchmarks/caesar-configuration-authority.js',
  'src/core/fea-benchmarks/caesar-accdb-linear-solve-governed.js',
  'src/core/fea-benchmarks/caesar-accdb-friction-solve.js',
  'src/core/fea-benchmarks/caesar-accdb-friction-solve-governed.js',
  'scripts/lfea-caesar-accdb-export-xml-compare.mjs',
  'scripts/lfea-m047-friction-contract-check.mjs',
  'scripts/lfea-m047-bm4l-friction-benchmark.mjs'
) | ForEach-Object { Invoke-Checked { node --check $_ } "node --check $_" }
Invoke-Checked { node scripts/lfea-caesar-configuration-authority-check.mjs } 'configuration authority check'
Invoke-Checked { node scripts/lfea-m047-friction-contract-check.mjs } 'friction contract check'

# Materialize the exact XML Compare Utilities ACCDB reader without modifying the user's checkout.
Remove-Item $xmlCompareCheckout -Force -Recurse -ErrorAction SilentlyContinue
$xmlCompareSource = $XML_COMPARE_REPO
if ($XmlCompareUtilitiesPath) {
  $xmlCompareSource = (Resolve-Path -LiteralPath $XmlCompareUtilitiesPath).Path
} else {
  $sibling = Join-Path (Split-Path $repoRoot -Parent) 'XML_Compare_Utilities'
  if (Test-Path -LiteralPath $sibling) { $xmlCompareSource = (Resolve-Path -LiteralPath $sibling).Path }
}
Invoke-Checked { git clone --quiet --no-checkout $xmlCompareSource $xmlCompareCheckout } 'clone XML Compare Utilities extractor source'
Invoke-Checked { git -C $xmlCompareCheckout checkout --quiet --detach $XML_COMPARE_COMMIT } 'checkout pinned XML Compare Utilities extractor commit'
$xmlHead = (& git -C $xmlCompareCheckout rev-parse HEAD).Trim().ToLowerInvariant()
if ($xmlHead -ne $XML_COMPARE_COMMIT) { throw "XML Compare Utilities commit mismatch: $xmlHead != $XML_COMPARE_COMMIT" }
$parserPath = Join-Path $xmlCompareCheckout 'parser/accdb-mdb.js'
$parserBlob = (& git -C $xmlCompareCheckout hash-object 'parser/accdb-mdb.js').Trim().ToLowerInvariant()
if ($parserBlob -ne $XML_COMPARE_PARSER_BLOB) { throw "XML Compare ACCDB parser blob mismatch: $parserBlob != $XML_COMPARE_PARSER_BLOB" }

if (-not $SkipExtractorInstall) {
  Remove-Item $readerRuntime -Force -Recurse -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $readerRuntime | Out-Null
  Invoke-Checked {
    npm install --prefix $readerRuntime --registry=$MDB_READER_REGISTRY --no-save --package-lock=false --ignore-scripts "mdb-reader@$MDB_READER_VERSION"
  } 'install pinned mdb-reader runtime from npm public registry'
  Remove-Item (Join-Path $xmlCompareCheckout 'node_modules') -Force -Recurse -ErrorAction SilentlyContinue
  Copy-Item -LiteralPath (Join-Path $readerRuntime 'node_modules') -Destination $xmlCompareCheckout -Recurse -Force
}
$readerPackagePath = Join-Path $xmlCompareCheckout 'node_modules/mdb-reader/package.json'
if (-not (Test-Path -LiteralPath $readerPackagePath)) {
  throw "Pinned mdb-reader runtime is unavailable at $readerPackagePath. Rerun without -SkipExtractorInstall."
}
$readerPackage = Get-Content -Raw $readerPackagePath | ConvertFrom-Json
if ([string]$readerPackage.name -ne 'mdb-reader' -or [string]$readerPackage.version -ne $MDB_READER_VERSION) {
  throw "mdb-reader package identity mismatch: $($readerPackage.name)@$($readerPackage.version) != mdb-reader@$MDB_READER_VERSION"
}
$readerRepository = if ($readerPackage.repository -is [string]) {
  [string]$readerPackage.repository
} else {
  [string]$readerPackage.repository.url
}
if ($readerRepository -notmatch 'github\.com/andipaetzold/mdb-reader') {
  throw "Unexpected mdb-reader repository identity: $readerRepository"
}

$zip = Join-Path $artifacts 'BM4_L.zip'
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/reallaksh19/Common/$COMMON/LFEA/BM4/BM4_L.zip" -OutFile $zip
if ((File-Sha256 $zip) -ne $ZIP_SHA256) { throw 'Pinned BM4_L.zip SHA-256 mismatch.' }
Assert-Git-Blob $zip $ZIP_GIT_BLOB 'BM4_L.zip'
Remove-Item $sourceDir -Force -Recurse -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $sourceDir | Out-Null
Expand-Archive $zip -DestinationPath $sourceDir -Force
$members = @(Get-ChildItem $sourceDir -File -Recurse)
if ($members.Count -ne 1 -or $members[0].Name -ne 'BM4_L.ACCDB') { throw 'Pinned ZIP must contain exactly BM4_L.ACCDB.' }
$accdb = $members[0].FullName
if ($members[0].Length -ne [int64]$ACCDB_BYTES) { throw "ACCDB byte count mismatch: $($members[0].Length)." }
if ((File-Sha256 $accdb) -ne $ACCDB_SHA256) { throw 'Pinned BM4_L.ACCDB SHA-256 mismatch.' }

$tables = @(
  'INPUT_BASIC_ELEMENT_DATA','INPUT_BENDS','INPUT_CONTROL','INPUT_FORCMNT','INPUT_NODAL_COORDINATES',
  'INPUT_OFFSETS','INPUT_REDUCERS','INPUT_RESTRAINTS','INPUT_RIGIDS','INPUT_SIFTEES','INPUT_UNITS',
  'OUTPUT_DISPLACEMENTS','OUTPUT_RESTRAINTS_SUMMARY','OUTPUT_GLOBAL_ELEMENT_FORCES'
) -join ','
$rawExport = Join-Path $artifacts 'bm4l-raw-export.json'
Invoke-Checked {
  node scripts/lfea-caesar-accdb-export-xml-compare.mjs `
    --accdb $accdb --tables $tables --xml-compare-root $xmlCompareCheckout `
    --mdb-reader-version $MDB_READER_VERSION |
    Set-Content -LiteralPath $rawExport -Encoding utf8
} 'XML Compare Utilities ACCDB read-only export'
$exportObject = Get-Content -Raw $rawExport | ConvertFrom-Json -Depth 100
if ($exportObject.source.sha256 -ne $ACCDB_SHA256) { throw 'Raw export is not bound to the pinned ACCDB SHA-256.' }
if ($exportObject.provider -ne $EXTRACTOR_PROVIDER) { throw "Unexpected ACCDB extractor provider: $($exportObject.provider)" }
if ($exportObject.extractor.runtimePolicy -ne $MDB_READER_RUNTIME_POLICY) { throw 'ACCDB extractor did not enforce the local-only mdb-reader runtime.' }
if ($exportObject.extractor.mdbReaderVersion -ne $MDB_READER_VERSION) { throw 'ACCDB extractor runtime version mismatch.' }
$readerRoot = [System.IO.Path]::GetFullPath((Join-Path $xmlCompareCheckout 'node_modules/mdb-reader'))
$readerPrefix = $readerRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$resolvedReaderEntrypoint = [System.IO.Path]::GetFullPath([string]$exportObject.extractor.mdbReaderEntrypoint)
if (-not $resolvedReaderEntrypoint.StartsWith($readerPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "ACCDB extractor resolved mdb-reader outside the pinned local runtime: $resolvedReaderEntrypoint"
}

$loadCaseReport = Join-Path $artifacts 'Loadcasereport_BM4_L.txt'
$miscReport = Join-Path $artifacts 'Miscdata_BM4_L.txt'
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/reallaksh19/Common/$COMMON/LFEA/BM4/Loadcasereport_BM4_L.txt" -OutFile $loadCaseReport
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/reallaksh19/Common/$COMMON/LFEA/BM4/Miscdata_BM4_L.txt" -OutFile $miscReport
Assert-Git-Blob $loadCaseReport $LOADCASE_GIT_BLOB 'Loadcasereport_BM4_L.txt'
Assert-Git-Blob $miscReport $MISC_GIT_BLOB 'Miscdata_BM4_L.txt'

$manifest = [ordered]@{
  schema='lfea-m047-bm4l-stage2-source-custody/v3'
  code=[ordered]@{head=$head; cleanWorktree=$true}
  commonCommit=$COMMON
  zip=[ordered]@{url="https://github.com/reallaksh19/Common/blob/$COMMON/LFEA/BM4/BM4_L.zip"; gitBlob=$ZIP_GIT_BLOB; byteLength=(Get-Item $zip).Length; sha256=(File-Sha256 $zip)}
  accdb=[ordered]@{fileName='BM4_L.ACCDB'; byteLength=(Get-Item $accdb).Length; sha256=(File-Sha256 $accdb)}
  loadCaseReport=[ordered]@{gitBlob=$LOADCASE_GIT_BLOB; byteLength=(Get-Item $loadCaseReport).Length; sha256=(File-Sha256 $loadCaseReport)}
  miscReport=[ordered]@{gitBlob=$MISC_GIT_BLOB; byteLength=(Get-Item $miscReport).Length; sha256=(File-Sha256 $miscReport)}
  profile=[ordered]@{path=$PROFILE; byteLength=(Get-Item $PROFILE).Length; sha256=(File-Sha256 $PROFILE)}
  extractor=[ordered]@{
    provider=$EXTRACTOR_PROVIDER
    repository=$XML_COMPARE_REPO
    source=$xmlCompareSource
    commit=$XML_COMPARE_COMMIT
    parserPath='parser/accdb-mdb.js'
    parserGitBlob=$XML_COMPARE_PARSER_BLOB
    entrypoint='readAccdbNamedTables'
    runtimePolicy=$MDB_READER_RUNTIME_POLICY
    mdbReaderRegistry=$MDB_READER_REGISTRY
    mdbReaderVersion=$MDB_READER_VERSION
    mdbReaderRepository=$readerRepository
    mdbReaderSourceRepository=$MDB_READER_SOURCE_REPO
    mdbReaderSourceTag=$MDB_READER_SOURCE_TAG
    mdbReaderSourceCommit=$MDB_READER_SOURCE_COMMIT
    mdbReaderLocalEntrypoint=$resolvedReaderEntrypoint
    mdbReaderPackageSha256=File-Sha256 $readerPackagePath
  }
}
$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $artifacts 'source-custody.json') -Encoding utf8

$config = Join-Path $artifacts 'resolved-configuration.json'
$actual = Join-Path $artifacts 'bm4l-friction-actual.json'
$report = Join-Path $artifacts 'bm4l-friction-report.json'
$summary = Join-Path $artifacts 'bm4l-friction-summary.md'
Invoke-Checked {
  node scripts/lfea-m047-bm4l-friction-benchmark.mjs `
    --raw-export $rawExport --profile $PROFILE --config-out $config `
    --actual-out $actual --report-out $report --summary-out $summary
} 'BM4_L Stage 2 friction qualification'

$actualJson = Get-Content -Raw $actual | ConvertFrom-Json -Depth 100
$reportJson = Get-Content -Raw $report | ConvertFrom-Json -Depth 100
if ($actualJson.sourceAccdbSha256 -ne $ACCDB_SHA256) { throw 'Actual result source hash mismatch.' }
if ($reportJson.nonlinearGate.status -ne 'PASS') { throw 'Nonlinear friction gate failed.' }
if ($reportJson.nonlinearGate.l15AlgebraicStatus -ne 'PASS') { throw 'L15 algebraic gate failed.' }
foreach ($caseId in @('L13','L7','L1')) {
  if ($actualJson.mechanics.repeatedRuns.$caseId.status -ne 'PASS') { throw "$caseId repeated-run determinism failed." }
}

$controlIds = @('L2','L3','L4','L5','L6','L14')
$controlRows = @($reportJson.qualification.cases | Where-Object { $controlIds -contains $_.caseId } | ForEach-Object { $_.comparison.rows })
$controlExternal = @($controlRows | Where-Object { $_.status -in @('PASS','FAIL') -and $_.quantity -in @(
  'DISPLACEMENT','ROTATION','FORCE','MOMENT','GLOBAL_END_FORCE_FROM','GLOBAL_END_FORCE_TO','GLOBAL_END_MOMENT_FROM','GLOBAL_END_MOMENT_TO'
) })
$controlFailures = @($controlExternal | Where-Object status -eq 'FAIL')
$controlRestraintFailures = @($controlFailures | Where-Object { $_.entityKind -eq 'NODE' -and $_.quantity -in @('FORCE','MOMENT') })
if ($controlFailures.Count -ne 46) { throw "Frozen non-friction control regression changed: expected 46 literal external failures, found $($controlFailures.Count)." }
if ($controlRestraintFailures.Count -ne 0) { throw "Frozen non-friction restraint regression changed: found $($controlRestraintFailures.Count) failures." }

$frictionPrimitiveIds = @('L13','L7','L1')
$frictionPrimitiveRows = @($reportJson.qualification.cases | Where-Object { $frictionPrimitiveIds -contains $_.caseId } | ForEach-Object { $_.comparison.rows })
$frictionPrimitiveRestraintFailures = @($frictionPrimitiveRows | Where-Object {
  $_.status -eq 'FAIL' -and $_.entityKind -eq 'NODE' -and $_.quantity -in @('FORCE','MOMENT')
})
if ($frictionPrimitiveRestraintFailures.Count -ne 0) {
  throw "Primitive friction restraint literal gate failed: $($frictionPrimitiveRestraintFailures.Count) components exceed tolerance."
}
$l15RestraintFailures = @($reportJson.qualification.cases | Where-Object caseId -eq 'L15' | ForEach-Object { $_.comparison.rows } | Where-Object {
  $_.status -eq 'FAIL' -and $_.entityKind -eq 'NODE' -and $_.quantity -in @('FORCE','MOMENT')
})

$sensitivityDiagnosticFailures = [ordered]@{}
foreach ($caseId in @('L13','L7','L1')) {
  $sensitivityDiagnosticFailures[$caseId] = [int]$reportJson.sensitivity.$caseId.diagnosticFailureCount
}

$receipt = [ordered]@{
  schema='lfea-m047-bm4l-stage2-production-receipt/v3'
  head=$head
  nodeVersion=$nodeVersion
  sourceAccdbSha256=$ACCDB_SHA256
  extractorProvider=$EXTRACTOR_PROVIDER
  extractorRuntimePolicy=$MDB_READER_RUNTIME_POLICY
  xmlCompareUtilitiesCommit=$XML_COMPARE_COMMIT
  mdbReaderVersion=$MDB_READER_VERSION
  mdbReaderSourceTag=$MDB_READER_SOURCE_TAG
  mdbReaderSourceCommit=$MDB_READER_SOURCE_COMMIT
  command='pwsh ./scripts/lfea-m047-bm4l-friction-production.ps1 -ExpectedHead <HEAD> [-XmlCompareUtilitiesPath <path>]'
  reportStatus=$reportJson.status
  nonlinearGate=$reportJson.nonlinearGate.status
  l15AlgebraicStatus=$reportJson.nonlinearGate.l15AlgebraicStatus
  l15DerivedEquilibriumStatus=$reportJson.nonlinearGate.l15DerivedEquilibriumStatus
  hydrotestAuthoritySchema=[string]$reportJson.resolvedConfiguration.hydrotestAuthority.schema
  hydrotestSourceFormula=[string]$reportJson.resolvedConfiguration.hydrotestAuthority.sourceFormula
  restraintTopologyStateScope=[string]$reportJson.restraintTopology.stateScope
  directionalFrictionRestraintCount=[int]$reportJson.restraintTopology.directionalRestraintCount
  sensitivityDiagnosticFailures=$sensitivityDiagnosticFailures
  nonFrictionLiteralExternalFailures=$controlFailures.Count
  nonFrictionRestraintFailures=$controlRestraintFailures.Count
  primitiveFrictionRestraintFailures=$frictionPrimitiveRestraintFailures.Count
  l15DerivedRestraintFailures=$l15RestraintFailures.Count
  artifacts=[ordered]@{
    sourceCustodySha256=File-Sha256 (Join-Path $artifacts 'source-custody.json')
    rawExportSha256=File-Sha256 $rawExport
    resolvedConfigurationSha256=File-Sha256 $config
    actualSha256=File-Sha256 $actual
    reportSha256=File-Sha256 $report
    summarySha256=File-Sha256 $summary
  }
}
$receipt | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $artifacts 'production-receipt.json') -Encoding utf8
Write-Output "M047 BM4_L friction Stage 2 local production run complete: $($reportJson.status)"
