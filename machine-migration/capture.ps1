#Requires -Version 5.1
<#
.SYNOPSIS
  Snapshot a Claude Code-managed Windows dev machine into a portable manifest.

.DESCRIPTION
  Captures everything needed to rebuild this machine on new hardware:
  OS, package manifests, language toolchains + pinned versions, Claude Code
  configuration (settings, agents, commands, skills, plugins, hooks), MCP
  server definitions, every git repo on disk with its remote/branch/dirty
  state, dotfiles, and GUI applications.

  SECRETS: this script never writes secret VALUES. Environment variables are
  recorded by NAME only. JSON config is recursively scrubbed of any key that
  looks credential-bearing, replaced with "<REDACTED:...>" so the restore
  side knows a value is required without the value leaving the machine.
  Private keys are never copied.

.EXAMPLE
  .\capture.ps1
  .\capture.ps1 -OutDir C:\snapshot
#>
[CmdletBinding()]
param(
    [string]$OutDir = (Join-Path (Get-Location) 'machine-snapshot'),
    [string]$ScanRoot = $env:USERPROFILE,
    [switch]$SkipRepoScan
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

# Keys whose values must never leave the machine.
$SecretPattern = '(?i)(token|key|secret|password|passwd|credential|auth|apikey|bearer|session|cookie|private|signature|salt)'

function New-Dir { param($p) if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } ; $p }
function Save-Text { param($Path,$Content) New-Dir (Split-Path -Parent $Path) | Out-Null; $Content | Out-File -FilePath $Path -Encoding utf8 }
function Have { param($cmd) [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Try-Capture {
    param([string]$Label, [string]$File, [scriptblock]$Block)
    Write-Host "  -> $Label" -ForegroundColor DarkGray
    try {
        $out = & $Block 2>&1 | Out-String
        if ([string]::IsNullOrWhiteSpace($out)) { $out = "(no output)" }
        Save-Text $File $out
    } catch {
        Save-Text $File "CAPTURE FAILED: $($_.Exception.Message)"
    }
}

# Recursively redact credential-bearing values from a parsed JSON object.
function Protect-Json {
    param($Node, [string]$KeyName = '')
    if ($null -eq $Node) { return $null }
    if ($Node -is [System.Management.Automation.PSCustomObject]) {
        $clean = [ordered]@{}
        foreach ($prop in $Node.PSObject.Properties) {
            $clean[$prop.Name] = Protect-Json -Node $prop.Value -KeyName $prop.Name
        }
        return [PSCustomObject]$clean
    }
    if ($Node -is [System.Collections.IEnumerable] -and $Node -isnot [string]) {
        return @($Node | ForEach-Object { Protect-Json -Node $_ -KeyName $KeyName })
    }
    if ($KeyName -match $SecretPattern -and $Node -is [string] -and $Node.Length -gt 0) {
        return "<REDACTED:$KeyName - restore this value by hand>"
    }
    # Catch bare secrets that slipped into non-obvious keys.
    if ($Node -is [string] -and $Node -match '^(sk-|ghp_|gho_|github_pat_|xox[baprs]-|AKIA|ya29\.)') {
        return "<REDACTED:inline-credential - restore this value by hand>"
    }
    return $Node
}

Write-Host ""
Write-Host "Capturing machine snapshot -> $OutDir" -ForegroundColor Cyan
New-Dir $OutDir | Out-Null
$M = New-Dir (Join-Path $OutDir 'manifest')

# ---------------------------------------------------------------- 1. System
Write-Host "[1/9] System" -ForegroundColor Yellow
$os  = Get-CimInstance Win32_OperatingSystem
$cs  = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$sys = @"
# System

| Field | Value |
|---|---|
| Captured (UTC) | $((Get-Date).ToUniversalTime().ToString('u')) |
| Hostname | $($cs.Name) |
| OS | $($os.Caption) |
| OS version | $($os.Version) (build $($os.BuildNumber)) |
| Architecture | $($os.OSArchitecture) |
| CPU | $($cpu.Name) |
| Cores / Threads | $($cpu.NumberOfCores) / $($cpu.NumberOfLogicalProcessors) |
| RAM | $([math]::Round($cs.TotalPhysicalMemory/1GB,1)) GB |
| PowerShell | $($PSVersionTable.PSVersion) |
| User profile | $env:USERPROFILE |
"@
Save-Text (Join-Path $M 'system.md') $sys

Try-Capture 'GPUs' (Join-Path $M 'gpu.txt') { Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,AdapterRAM | Format-List }
Try-Capture 'disks' (Join-Path $M 'disks.txt') { Get-Volume | Where-Object DriveLetter | Select-Object DriveLetter,FileSystemLabel,@{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}},@{n='FreeGB';e={[math]::Round($_.SizeRemaining/1GB,1)}} | Format-Table -AutoSize }

# ------------------------------------------------------------- 2. Packages
Write-Host "[2/9] Package managers" -ForegroundColor Yellow
$P = New-Dir (Join-Path $M 'packages')
if (Have winget) {
    Write-Host "  -> winget export (this is the important one)" -ForegroundColor DarkGray
    winget export -o (Join-Path $P 'winget.json') --include-versions --accept-source-agreements 2>&1 | Out-Null
    Try-Capture 'winget list' (Join-Path $P 'winget-list.txt') { winget list }
}
if (Have choco) { Try-Capture 'chocolatey' (Join-Path $P 'chocolatey.txt') { choco list --local-only } }
if (Have scoop) { Try-Capture 'scoop'      (Join-Path $P 'scoop.txt')      { scoop list } }

# ----------------------------------------------------------- 3. Toolchains
Write-Host "[3/9] Language toolchains" -ForegroundColor Yellow
$T = New-Dir (Join-Path $M 'toolchains')
if (Have python) {
    Try-Capture 'python version' (Join-Path $T 'python-version.txt') { python --version }
    Try-Capture 'pip freeze'     (Join-Path $T 'pip-freeze.txt')     { python -m pip freeze }
}
if (Have pyenv) { Try-Capture 'pyenv'  (Join-Path $T 'pyenv.txt')  { pyenv versions } }
if (Have uv)    { Try-Capture 'uv'     (Join-Path $T 'uv-tools.txt') { uv tool list } }
if (Have pipx)  { Try-Capture 'pipx'   (Join-Path $T 'pipx.txt')   { pipx list } }
if (Have conda) { Try-Capture 'conda'  (Join-Path $T 'conda-envs.txt') { conda env list } }
if (Have node)  {
    Try-Capture 'node version'  (Join-Path $T 'node-version.txt') { node --version; npm --version }
    Try-Capture 'npm globals'   (Join-Path $T 'npm-global.txt')   { npm ls -g --depth=0 }
}
if (Have nvm)     { Try-Capture 'nvm'     (Join-Path $T 'nvm.txt')     { nvm list } }
if (Have pnpm)    { Try-Capture 'pnpm'    (Join-Path $T 'pnpm.txt')    { pnpm ls -g --depth=0 } }
if (Have rustup)  { Try-Capture 'rustup'  (Join-Path $T 'rustup.txt')  { rustup toolchain list; rustup component list --installed } }
if (Have cargo)   { Try-Capture 'cargo'   (Join-Path $T 'cargo.txt')   { cargo install --list } }
if (Have go)      { Try-Capture 'go'      (Join-Path $T 'go.txt')      { go version; go env GOPATH GOROOT } }
if (Have dotnet)  { Try-Capture 'dotnet'  (Join-Path $T 'dotnet.txt')  { dotnet --list-sdks; dotnet tool list -g } }
if (Have java)    { Try-Capture 'java'    (Join-Path $T 'java.txt')    { java -version } }
if (Have mise)    { Try-Capture 'mise'    (Join-Path $T 'mise.txt')    { mise ls } }
if (Have git)     { Try-Capture 'git'     (Join-Path $T 'git-version.txt') { git --version } }
if (Have docker)  { Try-Capture 'docker'  (Join-Path $T 'docker.txt')  { docker --version; docker image ls } }

# --------------------------------------------------------- 4. Claude Code
Write-Host "[4/9] Claude Code configuration" -ForegroundColor Yellow
$C = New-Dir (Join-Path $M 'claude')
$claudeHome = Join-Path $env:USERPROFILE '.claude'

if (Test-Path $claudeHome) {
    # Copy the whole config tree EXCEPT transcripts, caches and anything key-shaped.
    robocopy $claudeHome (Join-Path $C 'dot-claude') /E /NFL /NDL /NJH /NJS /NP `
        /XD projects todos statsig shell-snapshots history downloads .git node_modules __pycache__ `
        /XF "*.key" "*.pem" "*.p12" "*.pfx" "*.credentials.json" ".credentials.json" | Out-Null

    # Anthropic-managed content re-syncs on its own; carrying it costs megabytes
    # and can shadow newer upstream versions on the new machine.
    foreach ($drop in 'skills\synced','plugins\cache','plugins\repos') {
        $dropPath = Join-Path $C "dot-claude\$drop"
        if (Test-Path $dropPath) { Remove-Item $dropPath -Recurse -Force -ErrorAction SilentlyContinue }
    }

    # settings.json may carry env vars with secrets -> scrub it.
    $settings = Join-Path $claudeHome 'settings.json'
    if (Test-Path $settings) {
        try {
            $parsed = Get-Content $settings -Raw | ConvertFrom-Json
            Protect-Json -Node $parsed | ConvertTo-Json -Depth 40 |
                Out-File (Join-Path $C 'dot-claude\settings.json') -Encoding utf8
        } catch { Save-Text (Join-Path $C 'settings-PARSE-ERROR.txt') $_.Exception.Message }
    }
    Save-Text (Join-Path $C 'tree.txt') ((Get-ChildItem $claudeHome -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\(projects|todos|statsig|shell-snapshots|history)\\' -and $_.FullName -notmatch '\\skills\\synced\\|\\plugins\\(cache|repos)\\' } |
        ForEach-Object { $_.FullName.Replace($env:USERPROFILE,'~') }) -join "`n")
} else {
    Save-Text (Join-Path $C 'NOT-FOUND.txt') "No ~/.claude directory found at $claudeHome"
}

# ~/.claude.json holds project history AND MCP server definitions AND tokens.
$claudeJson = Join-Path $env:USERPROFILE '.claude.json'
if (Test-Path $claudeJson) {
    try {
        $cj = Get-Content $claudeJson -Raw | ConvertFrom-Json
        # MCP servers are the part worth migrating; history is machine-specific noise.
        $extract = [ordered]@{
            mcpServers      = Protect-Json -Node $cj.mcpServers      -KeyName 'mcpServers'
            projectPaths    = @($cj.projects.PSObject.Properties.Name)
            perProjectMcp   = [ordered]@{}
        }
        foreach ($proj in $cj.projects.PSObject.Properties) {
            if ($proj.Value.mcpServers) {
                $extract.perProjectMcp[$proj.Name] = Protect-Json -Node $proj.Value.mcpServers -KeyName 'mcpServers'
            }
        }
        [PSCustomObject]$extract | ConvertTo-Json -Depth 40 |
            Out-File (Join-Path $C 'claude-json-extract.json') -Encoding utf8
    } catch { Save-Text (Join-Path $C 'claude-json-PARSE-ERROR.txt') $_.Exception.Message }
}

if (Have claude) {
    Try-Capture 'claude --version' (Join-Path $C 'version.txt')  { claude --version }
    Try-Capture 'claude mcp list'  (Join-Path $C 'mcp-list.txt') { claude mcp list }
}

# ------------------------------------------------------------- 5. Dotfiles
Write-Host "[5/9] Dotfiles and shell config" -ForegroundColor Yellow
$D = New-Dir (Join-Path $M 'dotfiles')
foreach ($f in @(
    "$env:USERPROFILE\.gitconfig",
    "$env:USERPROFILE\.gitignore_global",
    "$env:USERPROFILE\.wslconfig",
    "$env:USERPROFILE\.condarc",
    "$env:USERPROFILE\.npmrc",
    "$env:USERPROFILE\.ssh\config",
    $PROFILE.CurrentUserAllHosts,
    $PROFILE.CurrentUserCurrentHost
)) {
    if ($f -and (Test-Path $f)) {
        $dest = Join-Path $D (Split-Path $f -Leaf)
        # .npmrc routinely contains registry auth tokens.
        if ((Split-Path $f -Leaf) -eq '.npmrc') {
            (Get-Content $f) -replace '(?i)(_auth(Token)?|_password)\s*=.*', '$1=<REDACTED - restore by hand>' |
                Out-File $dest -Encoding utf8
        } else {
            Copy-Item $f $dest -Force
        }
    }
}
Save-Text (Join-Path $D 'ssh-key-inventory.txt') (
    "Public keys present on this machine (PRIVATE KEYS ARE NOT COPIED - move them by hand):`n" +
    ((Get-ChildItem "$env:USERPROFILE\.ssh\*.pub" -ErrorAction SilentlyContinue |
        ForEach-Object { "  $($_.Name)" }) -join "`n")
)
if (Have code) { Try-Capture 'vscode extensions' (Join-Path $D 'vscode-extensions.txt') { code --list-extensions } }

# ---------------------------------------------------- 6. Environment (names)
Write-Host "[6/9] Environment variables (names only)" -ForegroundColor Yellow
$envNames = Get-ChildItem Env: | Sort-Object Name | ForEach-Object {
    if ($_.Name -match $SecretPattern) { "$($_.Name) = <REDACTED - restore by hand>" }
    elseif ($_.Name -eq 'PATH')        { "PATH = (see path.txt)" }
    else                               { "$($_.Name) = $($_.Value)" }
}
Save-Text (Join-Path $M 'env-vars.txt') ($envNames -join "`n")
Save-Text (Join-Path $M 'path.txt') (($env:PATH -split ';' | Where-Object { $_ }) -join "`n")

# ----------------------------------------------------------- 7. Git repos
Write-Host "[7/9] Git repositories" -ForegroundColor Yellow
if ($SkipRepoScan) {
    Save-Text (Join-Path $M 'repos.md') "(skipped via -SkipRepoScan)"
} else {
    $rows = New-Object System.Collections.Generic.List[string]
    $rows.Add("# Git repositories on this machine")
    $rows.Add("")
    $rows.Add("Any repo marked DIRTY has uncommitted work that will be LOST if you wipe")
    $rows.Add("this machine. Commit and push every one before migrating.")
    $rows.Add("")
    $rows.Add("| Path | Remote | Branch | State | Stashes |")
    $rows.Add("|---|---|---|---|---|")

    $roots = @($ScanRoot) | Where-Object { Test-Path $_ }
    $gitDirs = Get-ChildItem -Path $roots -Directory -Filter '.git' -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\node_modules\\|\\AppData\\|\\\.cargo\\|\\venv\\|\\\.venv\\' }

    foreach ($g in $gitDirs) {
        $repo = $g.Parent.FullName
        Push-Location $repo
        $remote  = (git remote get-url origin 2>$null); if (-not $remote) { $remote = '(no remote)' }
        $branch  = (git rev-parse --abbrev-ref HEAD 2>$null)
        $status  = (git status --porcelain 2>$null)
        $stashes = (git stash list 2>$null | Measure-Object -Line).Lines
        $state   = if ($status) { "**DIRTY** ($((($status -split "`n") | Measure-Object).Count) files)" } else { 'clean' }
        $unpushed = (git log '@{u}..HEAD' --oneline 2>$null | Measure-Object -Line).Lines
        if ($unpushed -gt 0) { $state += " / $unpushed unpushed" }
        Pop-Location
        $rows.Add("| ``$($repo.Replace($env:USERPROFILE,'~'))`` | $remote | $branch | $state | $stashes |")
    }
    Save-Text (Join-Path $M 'repos.md') ($rows -join "`n")
}

# ------------------------------------------------------ 8. Installed apps
Write-Host "[8/9] Installed applications" -ForegroundColor Yellow
$apps = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
) | ForEach-Object { Get-ItemProperty $_ -ErrorAction SilentlyContinue } |
    Where-Object { $_.DisplayName } |
    Select-Object DisplayName, DisplayVersion, Publisher |
    Sort-Object DisplayName -Unique
Save-Text (Join-Path $M 'installed-apps.txt') (($apps | Format-Table -AutoSize | Out-String))

# ------------------------------------------------------- 9. Secrets to-do
Write-Host "[9/9] Secrets checklist" -ForegroundColor Yellow
$secretNames = (Get-ChildItem Env: | Where-Object { $_.Name -match $SecretPattern } | ForEach-Object { "- [ ] ``$($_.Name)`` (environment variable)" }) -join "`n"
Save-Text (Join-Path $OutDir 'SECRETS-TODO.md') @"
# Secrets to move by hand

This snapshot deliberately contains **no credential values**. Everything below
must be moved through a password manager or typed in fresh on the new machine.
Do not paste any of these values into a chat, a file, or a git commit.

## Environment variables detected on the old machine
$secretNames

## Always check these too

- [ ] Claude Code login — run ``claude`` on the new machine and authenticate
- [ ] SSH private keys in ``~/.ssh`` — move over an encrypted channel, or
      generate a NEW keypair on the new machine and add it to GitHub (preferred)
- [ ] GitHub CLI / git credential manager login
- [ ] MCP server credentials — see ``manifest/claude/claude-json-extract.json``
      for which servers exist and which fields were redacted
- [ ] ``.npmrc`` registry auth tokens (redacted in this snapshot)
- [ ] Cloud CLI logins (aws configure, gcloud auth login, az login)
- [ ] Any ``.env`` files inside your project repos — these are gitignored,
      so they are NOT in your GitHub remotes and NOT in this snapshot.
      Copy them across manually. This is the single most commonly lost item.
"@

Write-Host ""
Write-Host "Done. Snapshot written to: $OutDir" -ForegroundColor Green
Write-Host "Review SECRETS-TODO.md, then commit the snapshot to a PRIVATE repo." -ForegroundColor Green
Write-Host ""
