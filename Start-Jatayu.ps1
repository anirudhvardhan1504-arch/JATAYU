param([int]$ApiPort = 5001, [int]$WebPort = 3001)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$logRoot = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
function Test-JatayuApi {
 try { return (Invoke-RestMethod "http://localhost:$ApiPort/api/health" -TimeoutSec 5).platform -eq 'JATAYU Disaster Intelligence Platform' } catch { return $false }
}
function Test-JatayuWeb {
 try { return (Invoke-WebRequest "http://localhost:$WebPort/" -TimeoutSec 5 -UseBasicParsing).Content.Contains('JATAYU') } catch { return $false }
}
$env:PORT = "$ApiPort"
$env:VITE_BACKEND_URL = "http://localhost:$ApiPort"
if (!(Test-JatayuApi)) {
 Start-Process -FilePath $nodeExe -ArgumentList '../node_modules/tsx/dist/cli.mjs','src/index.ts' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'backend.log') -RedirectStandardError (Join-Path $logRoot 'backend-error.log') | Out-Null
}
if (!(Test-JatayuWeb)) {
 Start-Process -FilePath $nodeExe -ArgumentList '../node_modules/vite/bin/vite.js','--port',"$WebPort",'--strictPort' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'frontend.log') -RedirectStandardError (Join-Path $logRoot 'frontend-error.log') | Out-Null
}
Write-Host "JATAYU: http://localhost:$WebPort/"
Write-Host 'Weather requires both services. Chat additionally requires the Ollama app with llama3.1:8b.'
