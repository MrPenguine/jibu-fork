# Cleanup script for tools API endpoints
Write-Host "Removing old tools API endpoints..."

# Define the path to the tools API directory
$toolsApiPath = "apps\frontend\src\app\api\v1\tools"

# Check if the directory exists
if (Test-Path $toolsApiPath) {
    # Create a backup of the directory
    $backupPath = "tools-api-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "Creating backup at $backupPath"
    Copy-Item -Path $toolsApiPath -Destination $backupPath -Recurse
    
    # Remove the directory
    Write-Host "Removing $toolsApiPath directory"
    Remove-Item -Path $toolsApiPath -Recurse -Force
    
    Write-Host "Tools API endpoints removed successfully. A backup was created at $backupPath"
} else {
    Write-Host "Tools API directory not found at $toolsApiPath"
}

Write-Host "Cleanup complete!"
