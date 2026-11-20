param([string]$Source = ".catalog-source")

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$assets = Join-Path $PSScriptRoot "../app/src/main/assets"
$sourcePath = (Resolve-Path $Source).Path
$json = [IO.File]::ReadAllText((Join-Path $sourcePath "dist/exercises.json"))
$catalog = ConvertFrom-Json -InputObject $json
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
$options = [Drawing.Imaging.EncoderParameters]::new(1)
$options.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]72)

try {
    foreach ($exercise in $catalog) {
        foreach ($relative in $exercise.images) {
            if ($relative -notmatch '^[A-Za-z0-9_.()&,+%-][^/\\]*/[0-9]+\.jpg$' -or $relative.StartsWith("../")) {
                throw "Caminho de imagem inválido: $relative"
            }
            $destination = Join-Path $assets "photos/$relative"
            $null = [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
            $original = [Drawing.Image]::FromFile((Join-Path $sourcePath "exercises/$relative"))
            try {
                $scale = [Math]::Min(1.0, 320.0 / [Math]::Max($original.Width, $original.Height))
                $bitmap = [Drawing.Bitmap]::new($original, [int]($original.Width * $scale), [int]($original.Height * $scale))
                try { $bitmap.Save($destination, $jpeg, $options) } finally { $bitmap.Dispose() }
            } finally { $original.Dispose() }
        }
    }
} finally { $options.Dispose() }

[IO.File]::WriteAllText((Join-Path $assets "catalog.js"), "window.EXERCISES = $json;")
Copy-Item -LiteralPath (Join-Path $sourcePath "LICENSE.md") -Destination (Join-Path $assets "LICENSE-exercises.txt")
Write-Output "$($catalog.Count) exercícios preparados."
