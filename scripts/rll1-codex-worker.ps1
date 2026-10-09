[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$WslDistribution,
    [Parameter(Mandatory=$true)]
    [string]$RepoRootLinux,
    [Parameter(Mandatory=$true)]
    [string]$CommonRootLinux,
    [string]$WorkerId = "codex-local",
    [string]$AuthorizedLogin = "reallaksh19",
    [string]$RequiredCommonBasis = "22d365839e64c19c7ba606e2cf4edc6b9cc2999f",
    [string]$CodexUser = "rll-codex",
    [string]$CodexHomeLinux = "/home/rll-codex/.codex-rll",
    [string]$Timeout = "2h",
    [switch]$Smoke
)

$ErrorActionPreference = "Stop"

if ($env:GH_TOKEN -or $env:GITHUB_TOKEN) {
    throw "RLL refuses GH_TOKEN/GITHUB_TOKEN in the Windows task environment."
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw "WSL is required for the qualified Codex RLL worker."
}

function Quote-Bash([string]$Value) {
    return "'" + ($Value -replace "'", "'""'""'") + "'"
}

$launcher = "$CommonRootLinux/skills/engineering-pr-delivery-v3.1/scripts/rll_worker.py"
$args = @(
    "python3", (Quote-Bash $launcher),
    "--repo-root", (Quote-Bash $RepoRootLinux),
    "--repository", "reallaksh19/Advanced_Analysis",
    "--worker-id", (Quote-Bash $WorkerId),
    "--authorized-login", (Quote-Bash $AuthorizedLogin),
    "--executor", "codex",
    "--print-timeout", (Quote-Bash $Timeout),
    "--codex-user", (Quote-Bash $CodexUser),
    "--codex-home", (Quote-Bash $CodexHomeLinux)
)
if ($Smoke) { $args += "--smoke" }

$command = @(
    "set -euo pipefail",
    "unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GITHUB_ENTERPRISE_TOKEN",
    "test -f " + (Quote-Bash $launcher),
    "git -C " + (Quote-Bash $CommonRootLinux) + " cat-file -e " + (Quote-Bash "$RequiredCommonBasis^{commit}"),
    "git -C " + (Quote-Bash $CommonRootLinux) + " merge-base --is-ancestor " + (Quote-Bash $RequiredCommonBasis) + " HEAD",
    "gh auth status >/dev/null",
    "sudo -n -u " + (Quote-Bash $CodexUser) + " true",
    ($args -join " ")
) -join "; "

$wslArgs = @("-d", $WslDistribution, "--", "bash", "-lc", $command)
& wsl.exe @wslArgs
exit $LASTEXITCODE
