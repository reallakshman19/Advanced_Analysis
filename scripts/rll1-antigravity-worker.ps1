[CmdletBinding()]
param(
    [string]$CommonRoot = $env:COMMON_REPO_ROOT,
    [string]$WorkerId = "antigravity-local",
    [string]$AuthorizedLogin = "reallaksh19",
    [string]$RequiredCommonBasis = "049ebc556fb37a641709af9b786cea7cfedc6716",
    [string]$PrintTimeout = "2h",
    [ValidateSet("low","medium","high")]
    [string]$Effort = "high",
    [switch]$Smoke
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if ($env:GH_TOKEN -or $env:GITHUB_TOKEN) {
    throw "RLL refuses GitHub tokens from environment variables. Remove GH_TOKEN/GITHUB_TOKEN and authenticate with 'gh auth login --web' so GitHub CLI uses the OS credential store."
}

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
    throw "RLL-1 launcher not found at $Launcher. Checkout Common with the merged RLL-1 V3.1 transport."
}

& git -C $CommonRoot cat-file -e "$RequiredCommonBasis^{commit}" *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Required Common RLL-1 basis $RequiredCommonBasis is not present in $CommonRoot."
}
& git -C $CommonRoot merge-base --is-ancestor $RequiredCommonBasis HEAD *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Common checkout HEAD does not contain required RLL-1 basis $RequiredCommonBasis."
}

foreach ($tool in @("python", "git", "gh", "agy")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required command '$tool' is not available on PATH."
    }
}

& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is not authenticated. Run 'gh auth login --web' first using the OS credential store."
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
