#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string[]] $Match = @(),
  [int[]]    $Ports = @(),
  [int]      $From  = 0,
  [int]      $To    = 0,

  [switch]   $IncludeUdp,
  [switch]   $AllTcpStates,
  [switch]   $KillParents,      # SAFE MODE: never kills java.exe / IDE
  [switch]   $ShowDetails,
  [int]      $MaxPasses = 6,
  [int]      $DelayMs   = 250,
  [switch]   $Quiet
)

Set-StrictMode -Version Latest

# Repo root (for python orphan detection)
$script:RepoRoot = ""
try {
  if ($PSScriptRoot) {
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  }
} catch { $script:RepoRoot = "" }

$script:PythonServiceMarker = "python_ai_service"

function Write-Log {
  param(
    [Parameter(Mandatory)] [string] $Message,
    [ValidateSet('INFO','WARN','ERR','OK','DBG')] [string] $Level = 'INFO'
  )
  if ($Quiet -and $Level -in @('INFO','OK','DBG')) { return }
  $prefix = "[{0}] " -f $Level
  switch ($Level) {
    'ERR'  { Write-Host ($prefix + $Message) -ForegroundColor Red }
    'WARN' { Write-Host ($prefix + $Message) -ForegroundColor Yellow }
    'OK'   { Write-Host ($prefix + $Message) -ForegroundColor Green }
    'DBG'  { Write-Host ($prefix + $Message) -ForegroundColor DarkGray }
    default{ Write-Host ($prefix + $Message) }
  }
}

function Test-IsAdmin {
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { return $false }
}

function Safe-Lower([object]$x) {
  if ($null -eq $x) { return "" }
  try { return ([string]$x).ToLowerInvariant() } catch { return "" }
}

function Get-ProcCim([int]$ProcessId) {
  try {
    return Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $ProcessId) -ErrorAction Stop
  } catch { return $null }
}

function Get-ProcLabel([int]$ProcessId) {
  try {
    $p = Get-Process -Id $ProcessId -ErrorAction Stop
    return "{0} (PID {1})" -f $p.ProcessName, $ProcessId
  } catch {
    return "PID {0}" -f $ProcessId
  }
}

# Never kill these as parents (version B)
$script:StopNames = @(
  'system','registry',
  'smss.exe','csrss.exe','wininit.exe','winlogon.exe','services.exe','lsass.exe','svchost.exe',
  'explorer.exe','dwm.exe','conhost.exe','taskmgr.exe',
  'powershell.exe','pwsh.exe','cmd.exe',
  'idea64.exe','intellijidea64.exe','code.exe','devenv.exe',
  'java.exe'
)

# Typical respawners (no maven/gradle)
$script:RespawnCmdPatterns = @(
  'ts-node-dev','nodemon','vite','webpack','next','nuxt',
  'uvicorn','watchfiles',
  'npm','pnpm','yarn'
)

$script:AlreadyTriedKill = New-Object System.Collections.Generic.HashSet[int]

function Get-ParentChain([int]$StartProcessId, [int]$MaxDepth = 12) {
  $chain = @()
  $cur = $StartProcessId

  for ($i=0; $i -lt $MaxDepth; $i++) {
    $c = Get-ProcCim $cur
    if (-not $c) { break }

    $chain += [pscustomobject]@{
      Pid  = [int]$c.ProcessId
      Name = $c.Name
      PPid = [int]$c.ParentProcessId
      Cmd  = $c.CommandLine
    }

    if (-not $c.ParentProcessId -or $c.ParentProcessId -le 0) { break }
    $cur = [int]$c.ParentProcessId
  }

  return $chain
}

function Find-RespawnerParent([int]$ChildProcessId) {
  $chain = Get-ParentChain -StartProcessId $ChildProcessId -MaxDepth 12
  if (-not $chain -or $chain.Count -le 1) { return $null }

  for ($i=1; $i -lt $chain.Count; $i++) {
    $p = $chain[$i]
    $nameLower = Safe-Lower $p.Name

    if ($script:StopNames -contains $nameLower) { return $null }

    $cmd = ""
    if ($null -ne $p.Cmd) { $cmd = [string]$p.Cmd }

    foreach ($pat in $script:RespawnCmdPatterns) {
      if ($cmd -match [regex]::Escape($pat)) {
        # only return safe parent types
        if ($nameLower -in @('node.exe','python.exe','pythonw.exe')) {
          return [int]$p.Pid
        }
        return $null
      }
    }

    # fallback: allow only node/python as parent, never java/cmd/powershell
    if ($nameLower -in @('node.exe','python.exe','pythonw.exe') -and $cmd) {
      return [int]$p.Pid
    }
  }

  return $null
}

function Write-Details([int]$ProcessId) {
  if (-not $ShowDetails) { return }

  $c = Get-ProcCim $ProcessId
  if (-not $c) {
    Write-Log ("Details PID {0}: not readable / already gone." -f $ProcessId) "DBG"
    return
  }

  Write-Log ("Details {0}: ParentPID={1}" -f (Get-ProcLabel $ProcessId), $c.ParentProcessId) "DBG"
  if ($c.CommandLine) { Write-Log ("CMD: {0}" -f $c.CommandLine) "DBG" }

  $chain = Get-ParentChain -StartProcessId $ProcessId
  if ($chain -and $chain.Count -gt 1) {
    $pretty = ($chain | ForEach-Object { "{0}:{1}" -f $_.Pid,$_.Name }) -join "  <=  "
    Write-Log ("Chain: {0}" -f $pretty) "DBG"
  }
}

function Invoke-TaskkillSilent([int]$ProcessId) {
  $taskkillPath = Join-Path $env:WINDIR "System32\taskkill.exe"
  & $taskkillPath /PID $ProcessId /T /F 1>$null 2>$null
  return $LASTEXITCODE
}

function Kill-Tree {
  param(
    [Parameter(Mandatory)] [int] $TargetProcessId,
    [string] $Reason = ""
  )

  if ($TargetProcessId -le 0) { return }
  if ($TargetProcessId -eq $PID) {
    Write-Log ("Skipping this script process (PID {0})." -f $TargetProcessId) "WARN"
    return
  }

  if ($script:AlreadyTriedKill.Contains($TargetProcessId)) {
    Write-Log ("{0} was already attempted (skip)." -f (Get-ProcLabel $TargetProcessId)) "DBG"
    return
  }
  [void]$script:AlreadyTriedKill.Add($TargetProcessId)

  if (-not (Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue)) {
    Write-Log ("{0} is already stopped / not present." -f (Get-ProcLabel $TargetProcessId)) "DBG"
    return
  }

  Write-Details $TargetProcessId

  $label = Get-ProcLabel $TargetProcessId
  $msg   = if ($Reason) { "{0} -> kill (reason: {1})" -f $label, $Reason } else { "{0} -> kill" -f $label }

  if ($PSCmdlet.ShouldProcess($label, "taskkill /T /F")) {
    Write-Log $msg "INFO"

    $exitCode = Invoke-TaskkillSilent -ProcessId $TargetProcessId
    switch ($exitCode) {
      0   { Write-Log ("{0} taskkill OK." -f $label) "OK" }
      128 { Write-Log ("{0} already gone (ExitCode=128)." -f $label) "DBG" }
      default { Write-Log ("{0} could not be killed. ExitCode={1} (try Admin)." -f $label, $exitCode) "WARN" }
    }

    Start-Sleep -Milliseconds 100
    if (Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue) {
      Write-Log ("{0} still alive after taskkill -> Stop-Process -Force" -f $label) "WARN"
      try {
        Stop-Process -Id $TargetProcessId -Force -ErrorAction Stop
        Write-Log ("{0} Stop-Process OK." -f $label) "OK"
      } catch {
        Write-Log ("Stop-Process failed for {0}." -f $label) "WARN"
      }
    }
  } else {
    Write-Log ($msg + " (WhatIf/Confirm: not executed)") "DBG"
  }
}

function Pids-ByPort([int]$Port) {
  $set = New-Object System.Collections.Generic.HashSet[int]

  try {
    $tcp = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop
    if (-not $AllTcpStates) { $tcp = $tcp | Where-Object { $_.State -eq 'Listen' } }
    foreach ($c in $tcp) {
      $op = [int]$c.OwningProcess
      if ($op -gt 0) { [void]$set.Add($op) }
    }
    Write-Log ("Get-NetTCPConnection port {0} => PIDs: {1}" -f $Port, ((@($set) -join ", "))) "DBG"
  } catch {
    Write-Log ("Get-NetTCPConnection: no entries for port {0} (or access denied)." -f $Port) "DBG"
  }

  if ($set.Count -eq 0) {
    Write-Log ("Fallback: netstat -ano port {0}" -f $Port) "DBG"
    $lines = netstat -ano | Select-String -Pattern "[:\]]$Port(\s|$)"
    foreach ($m in $lines) {
      $line  = ($m.Line -replace '\s+', ' ').Trim()
      $parts = $line.Split(' ')
      if ($parts.Count -lt 4) { continue }

      $proto  = $parts[0]
      $local  = $parts[1]
      $pidStr = $parts[-1]

      if ($local -notmatch ":(\d+)$") { continue }
      if ([int]$Matches[1] -ne $Port) { continue }

      if ($proto -eq 'TCP' -and -not $AllTcpStates) {
        if ($line -notmatch '\sLISTENING\s') { continue }
      }

      if ($pidStr -match '^\d+$') {
        $pval = [int]$pidStr
        if ($pval -gt 0) { [void]$set.Add($pval) }
      }
    }
  }

  return @(@($set) | Sort-Object -Unique)
}

function Is-PythonServiceCmd([string]$CmdLine, [string]$ExePath) {
  if (-not $CmdLine -and -not $ExePath) { return $false }

  $cmd = ""
  if ($CmdLine) { $cmd = [string]$CmdLine }

  $exe = ""
  if ($ExePath) { $exe = [string]$ExePath }

  $looksLikeUvicorn = $false
  if ($cmd) {
    if ($cmd -match "(?i)\b(uvicorn|watchfiles)\b") { $looksLikeUvicorn = $true }
    if ($cmd -match "(?i)app\.main:app") { $looksLikeUvicorn = $true }
  }

  $mentionsService = $false
  if ($cmd) {
    if ($cmd.IndexOf($script:PythonServiceMarker, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $mentionsService = $true }
    if ($script:RepoRoot -and ($cmd.IndexOf($script:RepoRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)) { $mentionsService = $true }
  }
  if (-not $mentionsService -and $exe) {
    if ($exe.IndexOf($script:PythonServiceMarker, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $mentionsService = $true }
  }

  return ($looksLikeUvicorn -or $mentionsService)
}

function Get-TopPythonInChain([int]$StartProcessId) {
  $cur = $StartProcessId
  for ($i=0; $i -lt 12; $i++) {
    $c = Get-ProcCim $cur
    if (-not $c) { break }

    $ppid = [int]$c.ParentProcessId
    if ($ppid -le 0) { break }

    $p = Get-ProcCim $ppid
    if (-not $p) { break }

    $pName = Safe-Lower $p.Name
    if ($pName -notin @('python.exe','pythonw.exe')) { break }

    # only climb if parent also looks like our python service
    $pcmd = ""
    if ($p.CommandLine) { $pcmd = [string]$p.CommandLine }
    $pex = ""
    if ($p.ExecutablePath) { $pex = [string]$p.ExecutablePath }

    if (-not (Is-PythonServiceCmd -CmdLine $pcmd -ExePath $pex)) { break }

    $cur = [int]$p.ProcessId
  }
  return $cur
}

function Kill-PythonServiceOrphans {
  # Find python processes that belong to python_ai_service / uvicorn reload,
  # kill the top-most python in their chain (so watcher + worker go away).
  $targets = New-Object System.Collections.Generic.HashSet[int]
  try {
    $procs = Get-CimInstance Win32_Process -ErrorAction Stop
    foreach ($p in $procs) {
      $nameLower = Safe-Lower $p.Name
      if ($nameLower -notin @('python.exe','pythonw.exe')) { continue }

      $cmd = ""
      if ($p.CommandLine) { $cmd = [string]$p.CommandLine }
      $exe = ""
      if ($p.ExecutablePath) { $exe = [string]$p.ExecutablePath }

      if (Is-PythonServiceCmd -CmdLine $cmd -ExePath $exe) {
        $top = Get-TopPythonInChain -StartProcessId ([int]$p.ProcessId)
        if ($top -gt 0) { [void]$targets.Add($top) }
      }
    }
  } catch {
    Write-Log "Python orphan scan failed." "DBG"
  }

  $list = @(@($targets) | Sort-Object -Unique)
  if ($list.Count -gt 0) {
    Write-Log ("Python service targets => PIDs: {0}" -f ($list -join ", ")) "WARN"
    foreach ($procId in $list) {
      Kill-Tree -TargetProcessId $procId -Reason "Python service orphan cleanup"
    }
  } else {
    Write-Log "No python service targets found." "DBG"
  }
}

function Pids-ByMatch([string[]]$Patterns) {
  if (-not $Patterns -or $Patterns.Count -eq 0) { return @() }

  $set = New-Object System.Collections.Generic.HashSet[int]
  $procs = Get-CimInstance Win32_Process -ErrorAction Stop

  foreach ($p in $procs) {
    $cmd = $p.CommandLine
    if (-not $cmd) { continue }

    foreach ($m in $Patterns) {
      if ( (([string]$cmd).IndexOf([string]$m, [System.StringComparison]::OrdinalIgnoreCase)) -ge 0 ) {
        [void]$set.Add([int]$p.ProcessId)
        break
      }
    }
  }

  return @(@($set) | Sort-Object -Unique)
}

function Free-Port([int]$Port) {
  for ($pass=1; $pass -le $MaxPasses; $pass++) {
    $pids = @(Pids-ByPort $Port)

    if ($pids.Count -eq 0) {
      Write-Log ("Port {0}: free." -f $Port) "OK"
      return $true
    }

    Write-Log ("Port {0}: in use by PIDs: {1} (pass {2}/{3})" -f $Port, ($pids -join ", "), $pass, $MaxPasses) "INFO"

    foreach ($procId in $pids) {
      $parent = $null
      if ($KillParents) { $parent = Find-RespawnerParent -ChildProcessId $procId }

      Kill-Tree -TargetProcessId $procId -Reason ("Port {0}" -f $Port)

      if ($KillParents -and $parent -and $parent -ne $procId) {
        Write-Log ("Port {0}: respawning parent detected => {1}" -f $Port, (Get-ProcLabel $parent)) "WARN"
        Kill-Tree -TargetProcessId $parent -Reason ("Respawner for port {0}" -f $Port)
      }
    }

    Start-Sleep -Milliseconds $DelayMs
  }

  $still = @(Pids-ByPort $Port)
  if ($still.Count -gt 0) {
    Write-Log ("Port {0} still in use after {1} attempts: {2}" -f $Port, $MaxPasses, ($still -join ", ")) "WARN"
    foreach ($procId in $still) { Write-Details $procId }
    return $false
  }

  Write-Log ("Port {0}: free." -f $Port) "OK"
  return $true
}

# ========================= MAIN =========================
if (-not (Test-IsAdmin)) {
  Write-Log "Warning: Not running as Administrator. taskkill may fail for services/other users." "WARN"
}

if ($From -gt 0 -and $To -ge $From) {
  $Ports = @($Ports + ($From..$To)) | Sort-Object -Unique
}
$Ports = @($Ports | Where-Object { $_ -gt 0 } | Sort-Object -Unique)

Write-Log ("Inputs: Match=[{0}], Ports=[{1}], AllTcpStates={2}, IncludeUdp={3}, KillParents={4}" -f `
  ($Match -join ", "), ($Ports -join ", "), $AllTcpStates.IsPresent, $IncludeUdp.IsPresent, $KillParents.IsPresent) "INFO"

if ($Match.Count -gt 0) {
  foreach ($procId in @(Pids-ByMatch $Match)) {
    $parent = $null
    if ($KillParents) { $parent = Find-RespawnerParent -ChildProcessId $procId }

    Kill-Tree -TargetProcessId $procId -Reason "CommandLine match"

    if ($KillParents -and $parent -and $parent -ne $procId) {
      Write-Log ("Match: respawning parent detected => {0}" -f (Get-ProcLabel $parent)) "WARN"
      Kill-Tree -TargetProcessId $parent -Reason "Respawner for match"
    }
  }
}

foreach ($p in $Ports) {
  [void](Free-Port -Port $p)
}

# Final python cleanup:
# Only run if user included port 8000 in the request (keeps it safe).
if ($KillParents -and ($Ports -contains 8000)) {
  Kill-PythonServiceOrphans
}

exit 0
