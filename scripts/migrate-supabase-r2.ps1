# Runs the checked-in migration without putting credentials into command history.
# Example: powershell -ExecutionPolicy Bypass -File .\scripts\migrate-supabase-r2.ps1 -Phase Check
param(
  [ValidateSet("Check", "Copy", "Cutover")]
  [string]$Phase = "Check"
)

$ErrorActionPreference = "Stop"
$env:SUPABASE_URL = "https://tkplsmxyouexyirhkqlf.supabase.co"
$env:R2_ACCOUNT_ID = "65ca42da1b9474dcc4e329177d793b07"
$env:R2_BUCKET_NAME = "goongram-media"
$env:NEXT_PUBLIC_R2_PUBLIC_URL = "https://media.goongram.com"

function Read-MigrationSecret {
  param([string]$Label)
  $secure = Read-Host -Prompt $Label -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    $secure.Dispose()
  }
}

try {
  $env:SUPABASE_SERVICE_ROLE_KEY = Read-MigrationSecret "Supabase legacy service_role key"
  $env:R2_ACCESS_KEY_ID = Read-MigrationSecret "Cloudflare R2 public bucket Access Key ID"
  $env:R2_SECRET_ACCESS_KEY = Read-MigrationSecret "Cloudflare R2 public bucket Secret Access Key"

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is not installed or unavailable on PATH."
  }
  $script = Join-Path $PSScriptRoot "migrate-supabase-r2.mjs"
  switch ($Phase) {
    "Check" { & node $script }
    "Copy" { & node $script --execute }
    "Cutover" { & node $script --execute --update-db }
  }
  if ($LASTEXITCODE -ne 0) { throw "Migration failed with exit code $LASTEXITCODE" }
}
finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:R2_ACCESS_KEY_ID -ErrorAction SilentlyContinue
  Remove-Item Env:R2_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
}
