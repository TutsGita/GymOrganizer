param([string]$Source = ".catalog-source")

$ErrorActionPreference = "Stop"
$assets = Join-Path $PSScriptRoot "../app/src/main/assets"
$sourcePath = (Resolve-Path $Source).Path
$catalog = Get-Content -LiteralPath (Join-Path $sourcePath "dist/exercises.json") -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($exercise in $catalog) {
    $exercise.PSObject.Properties.Remove("images")
}
$json = ConvertTo-Json -InputObject $catalog -Depth 10 -Compress
[IO.File]::WriteAllText((Join-Path $assets "catalog.js"), "window.EXERCISES = $json;`n")
Copy-Item -LiteralPath (Join-Path $sourcePath "LICENSE.md") -Destination (Join-Path $assets "LICENSE-exercises.txt")
Write-Output "$($catalog.Count) exercícios preparados."
