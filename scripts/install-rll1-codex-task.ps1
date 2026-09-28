[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [Parameter(Mandatory=$true)]
    [string]$WslDistribution,
    [Parameter(Mandatory=$true)]
    [string]$RepoRootLinux,
    [Parameter(Mandatory=$true)]
    [string]$CommonRootLinux,
    [string]$RequiredCommonBasis = "5093474da3228720f73047226754c7e17f5ea5a3",
    [string]$CodexUser = "rll-codex",
    [string]$CodexHomeLinux = "/home/rll-codex/.codex-rll",
    [string]$TaskName = "Advanced_Analysis-RLL1-Codex",
    [int]$PilotIssue = 0,
    [switch]$EnableExecution
)

$ErrorActionPreference = "Stop"
$RepoRootWindows = Split-Path -Parent $PSScriptRoot
$Wrapper = Join-Path $PSScriptRoot "rll1-codex-worker.ps1"

if ($env:GH_TOKEN -or $env:GITHUB_TOKEN) {
    throw "RLL refuses GH_TOKEN/GITHUB_TOKEN in the scheduler environment."
}
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw "WSL is required."
}
if (-not (Get-Command schtasks.exe -ErrorAction SilentlyContinue)) {
    throw "Windows Task Scheduler CLI is required."
}
if (-not (Test-Path $Wrapper)) {
    throw "Codex RLL wrapper not found: $Wrapper"
}

function Quote-Bash([string]$Value) {
    return "'" + ($Value -replace "'", "'""'""'") + "'"
}
function Invoke-WslCheck([string]$Command) {
    & wsl.exe -d $WslDistribution -- bash -lc $Command
    if ($LASTEXITCODE -ne 0) { throw "WSL prerequisite check failed: $Command" }
}

$launcher = "$CommonRootLinux/skills/engineering-pr-delivery-v3.1/scripts/rll_codex_worker.py"
Invoke-WslCheck "set -e; command -v python3; command -v git; command -v gh; command -v codex; command -v sudo"
Invoke-WslCheck ("test -f " + (Quote-Bash $launcher))
Invoke-WslCheck ("git -C " + (Quote-Bash $CommonRootLinux) + " cat-file -e " + (Quote-Bash "$RequiredCommonBasis^{commit}"))
Invoke-WslCheck ("git -C " + (Quote-Bash $CommonRootLinux) + " merge-base --is-ancestor " + (Quote-Bash $RequiredCommonBasis) + " HEAD")
Invoke-WslCheck "gh auth status >/dev/null"
Invoke-WslCheck ("sudo -n -u " + (Quote-Bash $CodexUser) + " true")
Invoke-WslCheck ("sudo -n -u " + (Quote-Bash $CodexUser) + " env CODEX_HOME=" + (Quote-Bash $CodexHomeLinux) + " HOME=" + (Quote-Bash "/home/$CodexUser") + " codex login status >/dev/null")

$labels = @(
    @{ Name="rll-ready"; Color="1D76DB"; Description="RLL-1 eligible for unattended execution" },
    @{ Name="rll-active"; Color="FBCA04"; Description="RLL-1 local worker currently owns transport execution" },
    @{ Name="rll-review-ready"; Color="0E8A16"; Description="RLL-1 evidence ready for independent review; not acceptance" },
    @{ Name="rll-escalation"; Color="B60205"; Description="RLL-1 transport requires coordinator or Owner resolution" }
)
foreach ($label in $labels) {
    $cmd = "gh label create " + (Quote-Bash $label.Name) +
        " --repo reallaksh19/Advanced_Analysis --color " + (Quote-Bash $label.Color) +
        " --description " + (Quote-Bash $label.Description) + " --force >/dev/null"
    Invoke-WslCheck $cmd
}

if ($PilotIssue -gt 0 -and -not $EnableExecution) {
    $pilotJson = & wsl.exe -d $WslDistribution -- gh issue view $PilotIssue -R reallaksh19/Advanced_Analysis --json state,labels,body,comments
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect pilot issue #$PilotIssue" }
    $pilot = $pilotJson | ConvertFrom-Json
    if ($pilot.state -ne "OPEN") {
        throw "Pilot issue #$PilotIssue is not OPEN. Never reopen completed work for RLL smoke."
    }
    $pilotText = @($pilot.body) + @($pilot.comments | ForEach-Object { $_.body })
    if (($pilotText -join "`n") -notmatch "RLL_EXECUTION_V1") {
        throw "Pilot issue #$PilotIssue has no RLL_EXECUTION_V1 envelope."
    }
    if (($pilotText -join "`n") -match "state:\s*(REVIEW_READY|CANCELLED)") {
        throw "Pilot issue #$PilotIssue already has terminal RLL history."
    }
    & wsl.exe -d $WslDistribution -- gh issue edit $PilotIssue -R reallaksh19/Advanced_Analysis --add-label rll-ready *> $null
    if ($LASTEXITCODE -ne 0) { throw "Failed to mark pilot issue #$PilotIssue rll-ready" }
} elseif ($PilotIssue -gt 0 -and $EnableExecution) {
    Write-Host "Execution enablement does not relabel pilot issue #$PilotIssue."
}

$runnerDir = Join-Path $env:LOCALAPPDATA "RLL\Advanced_Analysis"
$runnerPath = Join-Path $runnerDir "run-codex-rll.ps1"
New-Item -ItemType Directory -Path $runnerDir -Force | Out-Null

$smokeArg = if ($EnableExecution) { "" } else { " -Smoke" }
$runner = @"
`$ErrorActionPreference = "Stop"
& "$Wrapper" -WslDistribution "$WslDistribution" -RepoRootLinux "$RepoRootLinux" -CommonRootLinux "$CommonRootLinux" -RequiredCommonBasis "$RequiredCommonBasis" -CodexUser "$CodexUser" -CodexHomeLinux "$CodexHomeLinux"$smokeArg
exit `$LASTEXITCODE
"@
if ($PSCmdlet.ShouldProcess($runnerPath, "Write credential-free RLL task runner")) {
    $runner | Set-Content -Path $runnerPath -Encoding UTF8
}

$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""
if ($PSCmdlet.ShouldProcess($TaskName, "Install 10-minute Codex RLL scheduled task")) {
    & schtasks.exe /Create /SC MINUTE /MO 10 /TN $TaskName /TR $taskCommand /RL LIMITED /F *> $null
    if ($LASTEXITCODE -ne 0) { throw "Failed to create scheduled task $TaskName" }
}

Write-Host "Installed task: $TaskName"
Write-Host "Runner: $runnerPath"
Write-Host "WSL distribution: $WslDistribution"
if ($EnableExecution) {
    Write-Host "Mode: EXECUTION ENABLED"
} else {
    Write-Host "Mode: SMOKE ONLY"
    Write-Host "Smoke mode prevents Codex invocation. Review the smoke before rerunning with -EnableExecution."
}
