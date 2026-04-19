# Removes legacy standalone chatbot folders when Windows releases file locks.
# Close Cursor/VS Code tabs, dev servers, and retry if you see EBUSY / EPERM.
$root = Split-Path -Parent $PSScriptRoot
foreach ($name in @('chatbot-service', 'chatbot-test-ui', 'python-chatbot-service')) {
  $p = Join-Path $root $name
  if (Test-Path $p) {
    Write-Host "Removing $p ..."
    Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Continue
  }
}
Write-Host "Done. If a folder remains, reboot or exclude the project from OneDrive sync and run again."
