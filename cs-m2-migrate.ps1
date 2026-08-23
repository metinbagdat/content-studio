<#
CS-M2 migration script — content-studio
Extracts lib/auth.ts + lib/platforms/* into packages/core, per
.github/issue-bodies/M2-shared-packages.md scope (narrow: only these two
modules — NOT a full lib/ migration).

USAGE
  cd C:\Users\mb\content-studio
  git checkout -b cs-m2-shared-core
  git status            # must be clean before running
  .\cs-m2-migrate.ps1

This script only MOVES files (git mv) and WRITES new/updated config files.
It does NOT run npm install / typecheck / build for you — do that after.

NOTE: lib/platforms/targets.selftest.ts is NOT moved (depends on lib/audience/segments).
#>

$ErrorActionPreference = 'Stop'
$pkgName = '@content-studio/core'

# ---------------------------------------------------------------------------
# 0. Guard rails
# ---------------------------------------------------------------------------
$dirty = git status --porcelain
if ($dirty) {
  Write-Host "Working tree not clean. Commit or stash first." -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------------------
# 1. Scaffold packages/core
# ---------------------------------------------------------------------------
$coreRoot = 'packages\core'
New-Item -ItemType Directory -Force -Path "$coreRoot\src\platforms" | Out-Null

# ---------------------------------------------------------------------------
# 2. Move the files (git mv preserves history)
# ---------------------------------------------------------------------------
git mv 'lib\auth.ts' "$coreRoot\src\auth.ts"
git mv 'lib\adminKey.ts' "$coreRoot\src\adminKey.ts"
git mv 'lib\platforms\formats.ts' "$coreRoot\src\platforms\formats.ts"
git mv 'lib\platforms\limits.ts' "$coreRoot\src\platforms\limits.ts"
git mv 'lib\platforms\targets.ts' "$coreRoot\src\platforms\targets.ts"
# selftest stays in lib/ — imports ../audience/segments (cannot live in packages/core)
if (Test-Path 'lib\platforms\targets.selftest.ts') {
  $selftest = Get-Content 'lib\platforms\targets.selftest.ts' -Raw
  $selftest = $selftest -replace "from\s+(['""])\./targets\1", "from `$1$pkgName/platforms/targets`$1"
  Set-Content -Path 'lib\platforms\targets.selftest.ts' -Value $selftest -NoNewline
  Write-Host "Keeping lib/platforms/targets.selftest.ts (import -> $pkgName/platforms/targets)." -ForegroundColor Yellow
} else {
  Remove-Item 'lib\platforms' -Force -Recurse -ErrorAction SilentlyContinue
}
Write-Host "Moved lib/auth.ts, lib/adminKey.ts, lib/platforms/{formats,limits,targets} -> $coreRoot\src\" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 3. Codemod imports -> @content-studio/core/*
# ---------------------------------------------------------------------------
$targetModules = @(
  @{ Old = 'adminKey';            New = 'adminKey' },
  @{ Old = 'auth';                New = 'auth' },
  @{ Old = 'platforms/formats';   New = 'platforms/formats' },
  @{ Old = 'platforms/limits';    New = 'platforms/limits' },
  @{ Old = 'platforms/targets';   New = 'platforms/targets' }
)

$searchRoots = @('apps\web', 'apps\worker', 'lib', 'packages\core\src', 'scripts')
$targets = Get-ChildItem -Path $searchRoots -Recurse -Include *.ts, *.tsx -File -ErrorAction SilentlyContinue
$changed = 0
foreach ($file in $targets) {
  $content = Get-Content $file.FullName -Raw
  $orig = $content
  foreach ($m in $targetModules) {
    $escaped = [regex]::Escape($m.Old)
    # @/lib/<module>
    $content = $content -replace "from\s+(['""])@\/lib\/$escaped\1", "from `$1$pkgName/$($m.New)`$1"
    # relative ../ or ./ (any depth for ../, single ./ for same-dir platforms)
    $content = $content -replace "from\s+(['""])(\.\./)+$escaped\1", "from `$1$pkgName/$($m.New)`$1"
    $content = $content -replace "from\s+(['""])\.\/$escaped\1", "from `$1$pkgName/$($m.New)`$1"
  }
  if ($content -ne $orig) {
    Set-Content -Path $file.FullName -Value $content -NoNewline
    $changed++
  }
}
Write-Host "Rewrote imports in $changed file(s)." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4. packages/core package.json + barrel
# ---------------------------------------------------------------------------
@"
{
  "name": "$pkgName",
  "version": "0.0.0",
  "private": true,
  "types": "./src/index.ts",
  "main": "./src/index.ts",
  "peerDependencies": {
    "next": ">=15.0.0"
  },
  "devDependencies": {
    "@prisma/client": "^6.9.0"
  }
}
"@ | Set-Content -Path "$coreRoot\package.json" -NoNewline

@"
export * from './adminKey'
export * from './auth'
export * as platformFormats from './platforms/formats'
export * as platformLimits from './platforms/limits'
export * from './platforms/targets'
"@ | Set-Content -Path "$coreRoot\src\index.ts" -NoNewline

# Fix auth.ts import of adminKey (same package, relative)
$authPath = "$coreRoot\src\auth.ts"
$authContent = Get-Content $authPath -Raw
$authContent = $authContent -replace "from\s+(['""])(@/lib/adminKey|@content-studio/core/adminKey)\1", "from './adminKey'"
Set-Content -Path $authPath -Value $authContent -NoNewline

Write-Host "Wrote $coreRoot\package.json + src\index.ts" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 5. Patch tsconfig path aliases (web + root worker tsconfig)
# ---------------------------------------------------------------------------
function Add-CorePathAlias($tsconfigPath) {
  if (-not (Test-Path $tsconfigPath)) { return }
  $json = Get-Content $tsconfigPath -Raw | ConvertFrom-Json
  if (-not $json.compilerOptions.paths) {
    $json.compilerOptions | Add-Member -NotePropertyName paths -NotePropertyValue (@{})
  }
  $paths = @{}
  foreach ($prop in $json.compilerOptions.paths.PSObject.Properties) {
    $paths[$prop.Name] = $prop.Value
  }
  $paths["$pkgName/*"] = @("../../packages/core/src/*")
  if ($tsconfigPath -match 'tsconfig\.json$' -and $tsconfigPath -notmatch 'apps\\web') {
    $paths["$pkgName/*"] = @("./packages/core/src/*")
  }
  $json.compilerOptions.paths = $paths
  $json | ConvertTo-Json -Depth 20 | Set-Content $tsconfigPath
  Write-Host "Patched paths in $tsconfigPath" -ForegroundColor Green
}

Add-CorePathAlias 'apps\web\tsconfig.json'
Add-CorePathAlias 'tsconfig.json'

# ---------------------------------------------------------------------------
# 6. apps/web + worker package.json dependencies
# ---------------------------------------------------------------------------
foreach ($pkgPath in @('apps\web\package.json', 'apps\worker\package.json')) {
  if (-not (Test-Path $pkgPath)) { continue }
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  if (-not $pkg.dependencies) { $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue (@{}) }
  $deps = @{}
  foreach ($p in $pkg.dependencies.PSObject.Properties) { $deps[$p.Name] = $p.Value }
  $deps[$pkgName] = '*'
  $pkg.dependencies = $deps
  $pkg | ConvertTo-Json -Depth 20 | Set-Content $pkgPath
  Write-Host "Added $pkgName to $pkgPath" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 7. next.config.js transpilePackages
# ---------------------------------------------------------------------------
$nextCfg = 'apps\web\next.config.js'
if (Test-Path $nextCfg) {
  $nc = Get-Content $nextCfg -Raw
  if ($nc -notmatch '@content-studio/core') {
    $nc = $nc -replace "transpilePackages:\s*\[([^\]]*)\]", "transpilePackages: [`$1, '@content-studio/core']"
    $nc = $nc -replace ",\s*'@content-studio/core'\s*,\s*'@content-studio/core'", ", '@content-studio/core'"
    Set-Content -Path $nextCfg -Value $nc -NoNewline
    Write-Host "Patched transpilePackages in $nextCfg" -ForegroundColor Green
  }
}

# ---------------------------------------------------------------------------
# 8. Remaining manual steps
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== Run after script ===" -ForegroundColor Cyan
Write-Host "  npm install"
Write-Host "  npm run typecheck"
Write-Host "  rg ""@/lib/auth|@/lib/adminKey|@/lib/platforms|from '\\.\\./auth|from '\\./platforms"" --glob '*.ts'"
Write-Host "  npm run dev"
Write-Host "  npm run worker"
Write-Host ""
Write-Host "Update docs/ROADMAP.md CS-M2 status when green." -ForegroundColor Cyan
