[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [Parameter(Mandatory=$true)]
    [string]$CommonRoot,
    [string]$Cron = "*/10 * * * *",
    [string]$RequiredCommonBasis = "8c013591659cbf42111d9d61d102e338f462cff5",
    [int]$PilotIssue = 0,
    [switch]$EnableExecution
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Wrapper = Join-Path $PSScriptRoot "rll1-antigravity-worker.ps1"

foreach ($tool in @("git", "gh", "agy")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required command '$tool' is not available on PATH."
    }
}

if (-not (Test-Path $Wrapper)) { throw "RLL wrapper not found: $Wrapper" }
$Launcher = Join-Path $CommonRoot "skills\engineering-pr-delivery-v3.1\scripts\rll_worker.py"
if (-not (Test-Path $Launcher)) { throw "Common RLL launcher not found: $Launcher" }

& git -C $CommonRoot cat-file -e "$RequiredCommonBasis^{commit}" *> $null
if ($LASTEXITCODE -ne 0) { throw "Required Common RLL-1 basis $RequiredCommonBasis is not present in $CommonRoot." }
& git -C $CommonRoot merge-base --is-ancestor $RequiredCommonBasis HEAD *> $null
if ($LASTEXITCODE -ne 0) { throw "Common checkout HEAD does not contain required RLL-1 basis $RequiredCommonBasis." }

& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI is not authenticated. Run 'gh auth login' first." }

$labels = @(
    [pscustomobject]@{ Name = "rll-ready";        Color = "1D76DB"; Description = "RLL-1 eligible for unattended execution" },
    [pscustomobject]@{ Name = "rll-active";       Color = "FBCA04"; Description = "RLL-1 local worker currently owns transport execution" },
    [pscustomobject]@{ Name = "rll-review-ready"; Color = "0E8A16"; Description = "RLL-1 evidence ready for independent review; not acceptance" },
    [pscustomobject]@{ Name = "rll-escalation";   Color = "B60205"; Description = "RLL-1 transport requires coordinator or Owner resolution" }
)

foreach ($label in $labels) {
    & gh label create $label.Name --repo "reallaksh19/Advanced_Analysis" --color $label.Color --description $label.Description --force *> $null
    if ($LASTEXITCODE -ne 0) { throw "Failed to create/update GitHub label $($label.Name)" }
}
if ($PilotIssue -gt 0) {
    $pilotText = & gh issue view $PilotIssue --repo "reallaksh19/Advanced_Analysis" --json body,comments --jq '.body, .comments[].body'
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect pilot issue #$PilotIssue" }
    if (($pilotText -join "`n") -notmatch "RLL_EXECUTION_V1") {
        throw "Pilot issue #$PilotIssue has no RLL_EXECUTION_V1 envelope; refusing to mark it ready."
    }
    & gh issue edit $PilotIssue --repo "reallaksh19/Advanced_Analysis" --add-label "rll-ready" *> $null
    if ($LASTEXITCODE -ne 0) { throw "Failed to mark pilot issue #$PilotIssue rll-ready" }
}

$homeDir = [Environment]::GetFolderPath("UserProfile")
$sidecarId = "advanced-analysis-rll1"
$sidecarDir = Join-Path $homeDir ".gemini\config\sidecars\$sidecarId"
$configPath = Join-Path $homeDir ".gemini\config\config.json"
$sidecarPath = Join-Path $sidecarDir "sidecar.json"

New-Item -ItemType Directory -Path $sidecarDir -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $configPath) -Force | Out-Null

$smoke = if ($EnableExecution) { "0" } else { "1" }
$sidecar = [ordered]@{
    display_name = "Advanced_Analysis RLL-1"
    description = "Engineering Relay V3.1 RLL-1 scheduled local worker"
    builtin = "schedule"
    args = @(
        $Cron,
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $Wrapper
    )
    restart_policy = "always"
    env = [ordered]@{
        COMMON_REPO_ROOT = (Resolve-Path $CommonRoot).Path
        RLL_SMOKE = $smoke
    }
}

if (Test-Path $configPath) {
    $raw = Get-Content $configPath -Raw
    $config = if ($raw.Trim()) { $raw | ConvertFrom-Json } else { [pscustomobject]@{} }
    $backup = "$configPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $configPath $backup
} else {
    $config = [pscustomobject]@{}
}

if (-not ($config.PSObject.Properties.Name -contains "sidecars")) {
    Add-Member -InputObject $config -MemberType NoteProperty -Name "sidecars" -Value ([pscustomobject]@{})
}
if ($null -eq $config.sidecars -or -not ($config.sidecars -is [psobject])) {
    throw "Existing Antigravity config 'sidecars' entry is not an object; refusing to overwrite it."
}
$sidecarEnablement = [pscustomobject]@{ enabled = $true }
Add-Member -InputObject $config.sidecars -MemberType NoteProperty -Name $sidecarId -Value $sidecarEnablement -Force

if ($PSCmdlet.ShouldProcess($sidecarPath, "Install RLL-1 Antigravity sidecar")) {
    $sidecar | ConvertTo-Json -Depth 10 | Set-Content $sidecarPath -Encoding UTF8
    $config | ConvertTo-Json -Depth 20 | Set-Content $configPath -Encoding UTF8
}

Write-Host "Installed sidecar: $sidecarId"
Write-Host "Cron: $Cron"
if ($EnableExecution) { Write-Host "Mode: EXECUTION ENABLED" } else { Write-Host "Mode: SMOKE ONLY" }
Write-Host "Sidecar config: $sidecarPath"
Write-Host "Antigravity config: $configPath"
if ($PilotIssue -gt 0) { Write-Host "Pilot issue: #$PilotIssue (rll-ready)" }
Write-Host ""
if (-not $EnableExecution) {
    Write-Host "Smoke mode prevents agy invocation. Review the smoke result before rerunning with -EnableExecution."
}
Write-Host "Restart or reload Antigravity if it does not detect the changed sidecar configuration automatically."
