# Start PostgreSQL using the project db folder (port 5433)
$dbPath = Join-Path $PSScriptRoot ".." "db"
$pgBin = "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
& $pgBin -D $dbPath -l (Join-Path $dbPath "logfile") start
