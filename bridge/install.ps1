# SpecSnap terminal/AI bridge installer for Windows (Chrome, Edge, Brave, Chromium).
# Run in PowerShell:  powershell -ExecutionPolicy Bypass -File bridge\install.ps1
$ErrorActionPreference = 'Stop'
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Id = 'haladpoicgmbenfflejlcgjmlgjompik'
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw 'Python 3 is required: https://www.python.org/downloads/ (tick "Add to PATH")'
}
$Manifest = Join-Path $Dir 'com.productcapture.host.json'
@{
  name = 'com.productcapture.host'
  description = 'SpecSnap terminal bridge'
  path = (Join-Path $Dir 'host.bat')
  type = 'stdio'
  allowed_origins = @("chrome-extension://$Id/")
} | ConvertTo-Json | Set-Content -Encoding UTF8 $Manifest

$Keys = @(
  'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.productcapture.host',
  'HKCU:\Software\Chromium\NativeMessagingHosts\com.productcapture.host',
  'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.productcapture.host',
  'HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.productcapture.host'
)
foreach ($k in $Keys) {
  New-Item -Path $k -Force | Out-Null
  Set-ItemProperty -Path $k -Name '(default)' -Value $Manifest
  Write-Host "registered $k"
}

$Conf = Join-Path $HOME '.config\productcapture'
New-Item -ItemType Directory -Force -Path $Conf | Out-Null
$Tok = Join-Path $Conf 'token'
if (-not (Test-Path $Tok)) { -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) }) | Set-Content -NoNewline $Tok }

$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($UserPath -notlike "*$Dir*") {
  [Environment]::SetEnvironmentVariable('Path', "$UserPath;$Dir", 'User')
  Write-Host "added $Dir to your PATH (open a new terminal)"
}
Write-Host "Done. Load/reload the extension (ID $Id), then run: specsnap --status"
