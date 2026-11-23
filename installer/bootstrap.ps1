#Requires -Version 5.1
<#
.SYNOPSIS
  Instala AgentCrew sin git clone: descarga ZIP de GitHub + npm install:all.

.EXAMPLE
  irm https://raw.githubusercontent.com/SoulThalion/AgentCrew/main/installer/bootstrap.ps1 | iex

.EXAMPLE
  .\bootstrap.ps1 -Ref main -Panel
#>
param(
  [string]$Repo = 'SoulThalion/AgentCrew',
  [string]$Ref = 'main',
  [string]$InstallDir = '',
  [switch]$Panel
)

$ErrorActionPreference = 'Stop'

function Assert-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw 'Node.js no encontrado. Instala Node 20+ desde https://nodejs.org'
  }
  $ver = (& node -v) -replace '^v', ''
  $major = [int]($ver.Split('.')[0])
  if ($major -lt 20) {
    throw "Node $ver detectado; hace falta >= 20."
  }
  Write-Host "Node v$ver OK"
}

function Expand-ZipSafe([string]$zip, [string]$dest) {
  if (Test-Path -LiteralPath $dest) {
    Remove-Item -LiteralPath $dest -Recurse -Force
  }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force
}

Assert-Node

if (-not $InstallDir) {
  $InstallDir = Join-Path $env:LOCALAPPDATA 'AgentCrew'
}

$zipUrl = "https://github.com/$Repo/archive/refs/heads/$Ref.zip"
# tags: refs/tags/v0.1.0.zip si Ref empieza por v
if ($Ref -match '^v?\d+\.') {
  $tag = if ($Ref.StartsWith('v')) { $Ref } else { "v$Ref" }
  $zipUrl = "https://github.com/$Repo/archive/refs/tags/$tag.zip"
}

$tmp = Join-Path $env:TEMP ("AgentCrew-bootstrap-" + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$zipPath = Join-Path $tmp 'src.zip'

try {
  Write-Host "Descargando $zipUrl …"
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

  $extract = Join-Path $tmp 'extract'
  Expand-ZipSafe $zipPath $extract
  $inner = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
  if (-not $inner) { throw 'ZIP sin carpeta raíz' }

  Write-Host "Instalando en $InstallDir …"
  if (Test-Path -LiteralPath $InstallDir) {
    # Conservar node_modules si existe para acelerar; reemplazar fuentes
    Get-ChildItem -LiteralPath $InstallDir -Force |
      Where-Object { $_.Name -ne 'node_modules' } |
      Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  }
  Copy-Item -Path (Join-Path $inner.FullName '*') -Destination $InstallDir -Recurse -Force

  Push-Location $InstallDir
  try {
    Write-Host 'npm run install:all …'
    npm run install:all
    if ($LASTEXITCODE -ne 0) { throw "install:all falló ($LASTEXITCODE)" }
    if ($Panel) {
      Write-Host 'Arrancando panel…'
      npm run panel:start
    } else {
      Write-Host ''
      Write-Host "Listo en $InstallDir"
      Write-Host 'Abre (o reinicia) Cursor: el watcher levanta el panel.'
      Write-Host 'Manual:  npm run panel:start'
    }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
