$ErrorActionPreference = 'Stop'

# Usage:
#   pwsh -File apps/koryxa/training/export_gguf.ps1 -LlamaCppDir C:\path\to\llama.cpp -SrcDir apps/koryxa/training/models/smollm-merged -OutDir apps/koryxa/training/models/gguf

param(
  [string]$LlamaCppDir = "./llama.cpp",
  [string]$SrcDir = "apps/koryxa/training/models/smollm-merged",
  [string]$OutDir = "apps/koryxa/training/models/gguf"
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "[1/3] Converting HF -> GGUF"
python "$LlamaCppDir/convert_hf_to_gguf.py" --outfile "$OutDir/smollm-merged-fp16.gguf" --outtype f16 "$SrcDir"

Write-Host "[2/3] Building quantize.exe if needed (MSVC or mingw)"
if (-not (Test-Path "$LlamaCppDir/quantize.exe")) {
  Push-Location $LlamaCppDir
  try { cmake -S . -B build -G "Ninja"; cmake --build build --target quantize } catch { Write-Warning "Build failed; ensure CMake and a compiler are installed." }
  Pop-Location
}

Write-Host "[3/3] Quantizing to q4_k_m"
& "$LlamaCppDir/quantize.exe" "$OutDir/smollm-merged-fp16.gguf" "$OutDir/smollm-merged-q4_k_m.gguf" q4_k_m

Write-Host "`n=== Export Completed ==="
Get-ChildItem -Recurse -File $OutDir | Measure-Object -Property Length -Sum | ForEach-Object { "Size: {0:N1} MB" -f ($_.Sum/1MB) }
Write-Host "Next: load the q4_k_m GGUF with llama.cpp or another compatible runtime."
