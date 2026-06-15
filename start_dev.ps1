$SA_EMAIL = "visionapiuserforlegal@watch-mail-trial.iam.gserviceaccount.com"
$ADC_PATH = "$env:APPDATA\gcloud\application_default_credentials.json"
$DEST_PATH = ".\backend\gcp-credentials.json"

Write-Host "======================================================="
Write-Host "  Legal Case Strategist - Local Dev Environment Setup"
Write-Host "======================================================="
Write-Host ""
Write-Host "Authenticating with Google Cloud to enable Vision OCR..."
Write-Host "Impersonating Service Account: $SA_EMAIL"
Write-Host ""

gcloud auth application-default login --impersonate-service-account=$SA_EMAIL

if (Test-Path $ADC_PATH) {
    Write-Host "Success! Copying credentials to backend environment..."
    Copy-Item -Path $ADC_PATH -Destination $DEST_PATH -Force
} else {
    Write-Host "ERROR: Failed to find Application Default Credentials at $ADC_PATH"
    Write-Host "Please ensure gcloud CLI is installed and you completed the browser login."
    exit 1
}

Write-Host "Starting Docker Compose..."
docker-compose up --build
