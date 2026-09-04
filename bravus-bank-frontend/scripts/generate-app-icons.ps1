$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root "public\brand\vantyx-app-icon-master.png"
$fullLogoPath = Join-Path $root "public\brand\vantyx-bank-logo.png"
$source = [System.Drawing.Bitmap]::new($sourcePath)
$fullLogo = [System.Drawing.Bitmap]::new($fullLogoPath)

try {
  $minX = $source.Width
  $minY = $source.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      if ($source.GetPixel($x, $y).A -gt 8) {
        $minX = [Math]::Min($minX, $x)
        $minY = [Math]::Min($minY, $y)
        $maxX = [Math]::Max($maxX, $x)
        $maxY = [Math]::Max($maxY, $y)
      }
    }
  }

  if ($maxX -lt $minX -or $maxY -lt $minY) {
    throw "O brasao de origem nao possui pixels visiveis."
  }

  $sourceRect = [System.Drawing.Rectangle]::new(
    $minX,
    $minY,
    $maxX - $minX + 1,
    $maxY - $minY + 1
  )

  function Write-VantyxIcon {
    param(
      [Parameter(Mandatory = $true)][string]$Path,
      [Parameter(Mandatory = $true)][int]$Size,
      [Parameter(Mandatory = $true)][double]$ContentScale,
      [Parameter(Mandatory = $true)][bool]$TransparentBackground
    )

    $target = [System.Drawing.Bitmap]::new(
      $Size,
      $Size,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($target)

    try {
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

      if ($TransparentBackground) {
        $graphics.Clear([System.Drawing.Color]::Transparent)
      }
      else {
        $graphics.Clear([System.Drawing.Color]::FromArgb(255, 3, 8, 23))
      }

      $maxContent = [Math]::Floor($Size * $ContentScale)
      $ratio = [Math]::Min(
        $maxContent / $sourceRect.Width,
        $maxContent / $sourceRect.Height
      )
      $contentWidth = [Math]::Max(1, [Math]::Round($sourceRect.Width * $ratio))
      $contentHeight = [Math]::Max(1, [Math]::Round($sourceRect.Height * $ratio))
      $destX = [Math]::Floor(($Size - $contentWidth) / 2)
      $destY = [Math]::Floor(($Size - $contentHeight) / 2)
      $destRect = [System.Drawing.Rectangle]::new($destX, $destY, $contentWidth, $contentHeight)

      $graphics.DrawImage(
        $source,
        $destRect,
        $sourceRect,
        [System.Drawing.GraphicsUnit]::Pixel
      )

      $directory = Split-Path -Parent $Path
      New-Item -ItemType Directory -Force -Path $directory | Out-Null
      $target.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $graphics.Dispose()
      $target.Dispose()
    }
  }

  function Write-VantyxSplash {
    param(
      [Parameter(Mandatory = $true)][string]$Path,
      [Parameter(Mandatory = $true)][int]$Width,
      [Parameter(Mandatory = $true)][int]$Height
    )

    $target = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    try {
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::FromArgb(255, 2, 15, 42))
      $size = [Math]::Floor([Math]::Min($Width, $Height) * 0.78)
      $x = [Math]::Floor(($Width - $size) / 2)
      $y = [Math]::Floor(($Height - $size) / 2)
      $graphics.DrawImage($fullLogo, [System.Drawing.Rectangle]::new($x, $y, $size, $size))
      $directory = Split-Path -Parent $Path
      New-Item -ItemType Directory -Force -Path $directory | Out-Null
      $target.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $graphics.Dispose()
      $target.Dispose()
    }
  }

  $densities = @(
    @{ Name = "mdpi"; Legacy = 48; Foreground = 108 },
    @{ Name = "hdpi"; Legacy = 72; Foreground = 162 },
    @{ Name = "xhdpi"; Legacy = 96; Foreground = 216 },
    @{ Name = "xxhdpi"; Legacy = 144; Foreground = 324 },
    @{ Name = "xxxhdpi"; Legacy = 192; Foreground = 432 }
  )

  foreach ($density in $densities) {
    $directory = Join-Path $root "android\app\src\main\res\mipmap-$($density.Name)"
    Write-VantyxIcon -Path (Join-Path $directory "ic_launcher.png") -Size $density.Legacy -ContentScale 1.0 -TransparentBackground $false
    Write-VantyxIcon -Path (Join-Path $directory "ic_launcher_round.png") -Size $density.Legacy -ContentScale 1.0 -TransparentBackground $false
    Write-VantyxIcon -Path (Join-Path $directory "ic_launcher_foreground.png") -Size $density.Foreground -ContentScale 1.0 -TransparentBackground $false
  }

  Write-VantyxIcon -Path (Join-Path $root "public\icon-192.png") -Size 192 -ContentScale 1.0 -TransparentBackground $false
  Write-VantyxIcon -Path (Join-Path $root "public\icon-512.png") -Size 512 -ContentScale 1.0 -TransparentBackground $false
  Write-VantyxIcon -Path (Join-Path $root "public\apple-touch-icon.png") -Size 180 -ContentScale 1.0 -TransparentBackground $false
  Write-VantyxIcon -Path (Join-Path $root "public\favicon.png") -Size 64 -ContentScale 1.0 -TransparentBackground $false
  Write-VantyxIcon -Path (Join-Path $root "public\favicon-32x32.png") -Size 32 -ContentScale 1.0 -TransparentBackground $false
  Write-VantyxIcon -Path (Join-Path $root "ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png") -Size 1024 -ContentScale 1.0 -TransparentBackground $false

  $androidSplashes = @(
    @{ Path = "android\app\src\main\res\drawable\splash.png"; Width = 480; Height = 320 },
    @{ Path = "android\app\src\main\res\drawable-land-mdpi\splash.png"; Width = 480; Height = 320 },
    @{ Path = "android\app\src\main\res\drawable-land-hdpi\splash.png"; Width = 800; Height = 480 },
    @{ Path = "android\app\src\main\res\drawable-land-xhdpi\splash.png"; Width = 1280; Height = 720 },
    @{ Path = "android\app\src\main\res\drawable-land-xxhdpi\splash.png"; Width = 1600; Height = 960 },
    @{ Path = "android\app\src\main\res\drawable-land-xxxhdpi\splash.png"; Width = 1920; Height = 1280 },
    @{ Path = "android\app\src\main\res\drawable-port-mdpi\splash.png"; Width = 320; Height = 480 },
    @{ Path = "android\app\src\main\res\drawable-port-hdpi\splash.png"; Width = 480; Height = 800 },
    @{ Path = "android\app\src\main\res\drawable-port-xhdpi\splash.png"; Width = 720; Height = 1280 },
    @{ Path = "android\app\src\main\res\drawable-port-xxhdpi\splash.png"; Width = 960; Height = 1600 },
    @{ Path = "android\app\src\main\res\drawable-port-xxxhdpi\splash.png"; Width = 1280; Height = 1920 }
  )
  foreach ($splash in $androidSplashes) {
    Write-VantyxSplash -Path (Join-Path $root $splash.Path) -Width $splash.Width -Height $splash.Height
  }
  foreach ($name in @("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png")) {
    Write-VantyxSplash -Path (Join-Path $root "ios\App\App\Assets.xcassets\Splash.imageset\$name") -Width 2732 -Height 2732
  }
}
finally {
  $source.Dispose()
  $fullLogo.Dispose()
}

Write-Host "Icones e telas de abertura Vantyx gerados com a marca centralizada e dentro da area segura."
