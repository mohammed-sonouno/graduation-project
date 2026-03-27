# Stop PostgreSQL running from the project db folder
$dbPath = Join-Path $PSScriptRoot ".." "db"
$pgBin = "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
& $pgBin -D $dbPath stop
