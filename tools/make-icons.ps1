# Generates the app icons (gradient rounded square with a V) using GDI+
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function New-Icon([int]$size, [string]$out) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $c1 = [System.Drawing.Color]::FromArgb(255, 124, 58, 237)   # violet
  $c2 = [System.Drawing.Color]::FromArgb(255, 34, 211, 238)   # cyan
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)

  $r = [int]($size * 0.22)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, 2*$r, 2*$r, 180, 90)
  $path.AddArc($size - 2*$r, 0, 2*$r, 2*$r, 270, 90)
  $path.AddArc($size - 2*$r, $size - 2*$r, 2*$r, 2*$r, 0, 90)
  $path.AddArc(0, $size - 2*$r, 2*$r, 2*$r, 90, 90)
  $path.CloseFigure()
  $g.FillPath($brush, $path)

  $fontSize = [float]($size * 0.55)
  $font = $null
  foreach ($name in @('Segoe UI Black', 'Arial Black', 'Arial')) {
    try { $font = New-Object System.Drawing.Font($name, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel); break } catch {}
  }
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = New-Object System.Drawing.RectangleF(0, [float]($size * 0.01), $size, $size)
  $g.DrawString('V', $font, [System.Drawing.Brushes]::White, $textRect, $sf)

  # small spark dot (top-right)
  $sp = [int]($size * 0.10)
  $g.FillEllipse([System.Drawing.Brushes]::White, [int]($size*0.70), [int]($size*0.16), $sp, $sp)

  $g.Dispose()
  $dir = Split-Path -Parent $out
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "icon -> $out"
}

New-Icon 1024 (Join-Path $repo 'build\icon.png')
New-Icon 512  (Join-Path $repo 'app\assets\icon-512.png')
New-Icon 192  (Join-Path $repo 'app\assets\icon-192.png')
New-Icon 64   (Join-Path $repo 'app\assets\favicon.png')
