# PowerShell script to replace all instances of font-regular with font-mono in the codebase

Write-Host "Replacing 'font-regular' with 'font-mono' across the codebase..."

# Get all .tsx and .css files regardless of content
$files = Get-ChildItem -Path .\src -Recurse -Include *.tsx,*.css

# Process each file
foreach ($file in $files) {
    Write-Host "Processing $($file.FullName)..."
    # Read the file content
    $content = Get-Content -Path $file.FullName -Raw
    
    # Check if the file contains the pattern
    if ($content -match "font-regular") {
        # Replace font-regular with font-mono
        $newContent = $content -replace "font-regular", "font-mono"
        # Write the file back
        Set-Content -Path $file.FullName -Value $newContent
        Write-Host "  - Replaced instances in $($file.Name)" -ForegroundColor Green
    }
}

# Also replace in index.css for the CSS variable
if (Test-Path .\src\index.css) {
    $cssFile = ".\src\index.css"
    Write-Host "Processing $cssFile..."
    $cssContent = Get-Content -Path $cssFile -Raw
    if ($cssContent -match "--font-regular") {
        $newCssContent = $cssContent -replace "--font-regular", "--font-mono"
        Set-Content -Path $cssFile -Value $newCssContent
        Write-Host "  - Replaced CSS variable in index.css" -ForegroundColor Green
    }
}

Write-Host "Replacement complete!" -ForegroundColor Cyan 