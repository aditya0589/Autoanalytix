param(
    [string]$Region = "us-east-1",
    [string]$AccountId = "",
    [string]$S3Bucket = "",
    [string]$CodeBuildProject = "autoanalytix-builder",
    [string]$FunctionName = "autoanalytix-backend",
    [string]$ImageUri = ""
)

if (-not $AccountId) {
    $AccountId = (aws sts get-caller-identity --query Account --output text 2>$null)
    if (-not $AccountId -or $AccountId -match "None|error") {
        Write-Error "Could not retrieve AWS Account ID. Please configure AWS CLI credentials or pass -AccountId."
        exit 1
    }
}

if (-not $S3Bucket) {
    $S3Bucket = "autoanalytix-builds-$AccountId"
}

if (-not $ImageUri) {
    $ImageUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/autoanalytix-backend:latest"
}

Write-Host "[1/5] Packing backend source..."
& .\venv\Scripts\python.exe scripts/pack_backend.py
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to pack backend."
    exit 1
}

Write-Host "[2/5] Uploading source zip to S3..."
aws s3 cp backend_source.zip "s3://$S3Bucket/autoanalytix/backend_source.zip"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to upload to S3."
    exit 1
}

Write-Host "[3/5] Triggering AWS CodeBuild container build ($CodeBuildProject)..."
$BuildOutput = aws codebuild start-build --project-name $CodeBuildProject --region $Region --query "build.id" --output text
if (-not $BuildOutput) {
    Write-Error "Failed to start CodeBuild."
    exit 1
}
Write-Host "   Build started: $BuildOutput. Waiting for container to build..."

do {
    Start-Sleep -Seconds 10
    $Status = aws codebuild batch-get-builds --ids $BuildOutput --region $Region --query "builds[0].buildStatus" --output text
    Write-Host "   Status: $Status"
} while ($Status -eq "IN_PROGRESS")

if ($Status -ne "SUCCEEDED") {
    Write-Error "CodeBuild container build failed with status: $Status"
    exit 1
}

Write-Host "[4/5] Updating Lambda function code with new container..."
aws lambda update-function-code --function-name $FunctionName --image-uri $ImageUri --region $Region | Out-Null
aws lambda wait function-updated --function-name $FunctionName --region $Region

Write-Host "[5/5] Ensuring Lambda URL has clean CORS (FastAPI managed)..."
aws lambda update-function-url-config --function-name $FunctionName --cors "{}" --region $Region 2>$null | Out-Null

$FunctionUrl = (aws lambda get-function-url-config --function-name $FunctionName --region $Region --query FunctionUrl --output text)
Write-Host "[SUCCESS] Lambda deployment complete!"
Write-Host "   Public Function URL: $FunctionUrl"
