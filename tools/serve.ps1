# Vans AI Studio - local web server + image proxy (no dependencies).
# Uses HttpListener with a runspace pool so every request is handled concurrently;
# a slow /proxy download never blocks serving the app.
param(
  [int]$Port = 8765,
  [switch]$Open,
  [string]$Root = ""
)
$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\app' }
$Root = (Resolve-Path $Root).Path
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11
[Net.ServicePointManager]::DefaultConnectionLimit = 64

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try { $listener.Start() } catch {
  Write-Host "  Could not start on port $Port : $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  Vans AI Studio  |  http://localhost:$Port/" -ForegroundColor Cyan
Write-Host "  Serving: $Root"
Write-Host "  Press Ctrl+C to stop."
Write-Host ""
if ($Open) { Start-Process "http://localhost:$Port/" }

# each request is processed here, on a pool thread
$handler = {
  param($ctx, $Root)
  $mime = @{
    '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'
    '.css'='text/css; charset=utf-8';   '.js'='application/javascript; charset=utf-8'
    '.json'='application/json; charset=utf-8'; '.webmanifest'='application/manifest+json'
    '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'
    '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.webp'='image/webp'
    '.wav'='audio/wav'; '.mp3'='audio/mpeg'; '.webm'='video/webm'
    '.stl'='application/octet-stream'; '.woff'='font/woff'; '.woff2'='font/woff2'
  }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

    if ($path -eq '/proxy') {
      # server-side fetch: no Origin header -> no browser bot-check (works like curl)
      $target = $req.QueryString['url']
      $res.Headers['Access-Control-Allow-Origin'] = '*'
      $res.Headers['Cache-Control'] = 'no-cache'
      $bytes = $null; $ctype = 'application/octet-stream'
      $valid = $false
      try {
        $uri = [Uri]$target
        if ($uri.Scheme -eq 'https' -and $uri.Host.ToLower().EndsWith('pollinations.ai')) {
          # Pollinations allows one queued request per IP; on 429 wait for it to
          # clear, then retry. Backoff is tuned to their ~1-2s queue turnover.
          for ($attempt = 0; $attempt -lt 6 -and -not $valid; $attempt++) {
            if ($attempt -gt 0) { Start-Sleep -Milliseconds (900 + 700 * $attempt) }
            try {
              $wr = [System.Net.HttpWebRequest]::Create($uri)
              $wr.UserAgent = 'VansAiStudio/1.0'
              $wr.Timeout = 100000; $wr.ReadWriteTimeout = 100000
              $resp = $wr.GetResponse()
              $ctype = $resp.ContentType
              $ms = New-Object System.IO.MemoryStream
              $resp.GetResponseStream().CopyTo($ms)
              $bytes = $ms.ToArray()
              $resp.Close()
              if ($bytes.Length -gt 200) { $valid = $true }
            } catch {
              $er = $_.Exception.Response
              if ($er) { try { $er.Close() } catch { } }   # release the connection before retry
            }
          }
        }
      } catch { }
      if ($valid) {
        $res.ContentType = $ctype
        $res.Headers['Cache-Control'] = 'public, max-age=86400'
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $eb = [System.Text.Encoding]::UTF8.GetBytes('proxy: upstream unavailable')
        $res.StatusCode = 502; $res.ContentType = 'text/plain'
        $res.ContentLength64 = $eb.Length
        $res.OutputStream.Write($eb, 0, $eb.Length)
      }
      $res.Close()
      return
    }

    # ---- static files ----
    if ($path.EndsWith('/')) { $path = $path + 'index.html' }
    $full = [System.IO.Path]::GetFullPath((Join-Path $Root ($path -replace '/', '\')))
    if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $b = [System.Text.Encoding]::UTF8.GetBytes('404 - not found')
      $res.StatusCode = 404; $res.ContentType = 'text/plain; charset=utf-8'
      $res.ContentLength64 = $b.Length; $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      return
    }
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $ext = [System.IO.Path]::GetExtension($full).ToLower()
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $res.Headers['Cache-Control'] = 'no-cache'
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
  } catch {
    try { $res.StatusCode = 500; $res.Close() } catch { }
  }
}

$pool = [runspacefactory]::CreateRunspacePool(1, 16)
$pool.Open()
$pending = New-Object System.Collections.ArrayList

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()          # accept next request (fast); handling is offloaded
    $ps = [powershell]::Create()
    $ps.RunspacePool = $pool
    $null = $ps.AddScript($handler).AddArgument($ctx).AddArgument($Root)
    $h = $ps.BeginInvoke()
    [void]$pending.Add([pscustomobject]@{ ps = $ps; handle = $h })
    # prune finished handlers to avoid leaks
    for ($i = $pending.Count - 1; $i -ge 0; $i--) {
      if ($pending[$i].handle.IsCompleted) {
        try { $pending[$i].ps.EndInvoke($pending[$i].handle) } catch { }
        $pending[$i].ps.Dispose()
        $pending.RemoveAt($i)
      }
    }
  }
} finally {
  $listener.Stop(); $pool.Close()
}
