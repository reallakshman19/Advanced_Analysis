[CmdletBinding()]
param(
    [string]$CommonRoot = $env:COMMON_REPO_ROOT,
    [string]$WorkerId = "antigravity-local",
    [string]$AuthorizedLogin = "reallaksh19",
    [string]$PrintTimeout = "2h",
    [ValidateSet("low","medium","high")]
    [string]$Effort = "high",
    [switch]$Smoke
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not $env:RLL_DATA_DIR -and $env:ANTIGRAVITY_EXECUTABLE_DATA_DIR) {
    $env:RLL_DATA_DIR = Join-Path $env:ANTIGRAVITY_EXECUTABLE_DATA_DIR "rll"
}

if (-not $CommonRoot) {
    $candidate = Join-Path (Split-Path -Parent $RepoRoot) "Common"
    if (Test-Path $candidate) { $CommonRoot = $candidate }
}

if (-not $CommonRoot) {
    throw "Common checkout not found. Set COMMON_REPO_ROOT or pass -CommonRoot."
}

$Launcher = Join-Path $CommonRoot "skills\engineering-pr-delivery-v3.1\scripts\rll_worker.py"
if (-not (Test-Path $Launcher)) {
    throw "RLL-1 launcher not found at $Launcher. Checkout Common with the RLL-1 V3.1 transport."
}

foreach ($tool in @("python", "git", "gh", "agy")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required command '$tool' is not available on PATH."
    }
}

& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is not authenticated. Run 'gh auth login' interactively first."
}

$arguments = @(
    $Launcher,
    "--repo-root", $RepoRoot,
    "--repository", "reallaksh19/Advanced_Analysis",
    "--worker-id", $WorkerId,
    "--authorized-login", $AuthorizedLogin,
    "--print-timeout", $PrintTimeout,
    "--effort", $Effort
)

$smokeRequested = $Smoke -or ($env:RLL_SMOKE -eq "1")
if ($smokeRequested) { $arguments += "--smoke" }

& python @arguments
exit $LASTEXITCODE
