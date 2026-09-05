param([switch]$Delete)
$testImageRoots = @(
 'C:\Users\vikra\OneDrive\Documents\GitHub\testcode\sandbox',
 'C:\Users\vikra\testcode-source-publication\sandbox',
 'C:\Users\vikra\globalgrid-testcode-publication\testcode'
)
$inventoryFile = 'C:\Users\vikra\OneDrive\Documents\GitHub\testcode\screenshots\DELETE-BUILD-IMAGE-INVENTORY.json'
if (-not $Delete) {
 $testImages = foreach ($testImageRoot in $testImageRoots) {
  Get-ChildItem -LiteralPath $testImageRoot -File -Recurse | Where-Object {
   $_.Extension -in '.png','.jpg','.jpeg','.webp' -and $_.FullName -match '\\(evidence[^\\]*|compatibility[^\\]*|screenshots)\\'
  } | Select-Object FullName,Length
 }
 $testImages | ConvertTo-Json | Set-Content -LiteralPath $inventoryFile
 Write-Output ('Inventoried ' + @($testImages).Count + ' generated test images')
 exit
}
$testImages = Get-Content -LiteralPath $inventoryFile -Raw | ConvertFrom-Json
foreach ($testImage in $testImages) {
 $testImagePath = [IO.Path]::GetFullPath($testImage.FullName)
 $insideApprovedRoot = $false
 foreach ($testImageRoot in $testImageRoots) {
  if ($testImagePath.StartsWith($testImageRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { $insideApprovedRoot = $true }
 }
 if (-not $insideApprovedRoot -or [IO.Path]::GetExtension($testImagePath) -notin '.png','.jpg','.jpeg','.webp' -or $testImagePath -notmatch '\\(evidence[^\\]*|compatibility[^\\]*|screenshots)\\') { throw 'Invalid screenshot target' }
 Remove-Item -LiteralPath $testImagePath
}
Write-Output ('Deleted ' + @($testImages).Count + ' generated test images')
