param(
    [string]$Region = "us-east-1",
    [string]$RepoName = "autoanalytix-backend",
    [string]$FunctionName = "autoanalytix-backend"
)

$AccountId = (aws sts get-caller-identity --query Account --output text)
if (-not $AccountId) {
    Write-Error "Failed to obtain AWS Account ID. Please ensure AWS CLI is installed and configured ('aws configure')."
    exit 1
}

$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$ImageUri = "$EcrUri/$RepoName`:latest"

Write-Host "1. Authenticating with ECR..."
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $EcrUri

Write-Host "2. Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names $RepoName --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating ECR repository: $RepoName"
    aws ecr create-repository --repository-name $RepoName --region $Region
}

Write-Host "3. Building Docker container for linux/amd64..."
docker build --platform linux/amd64 -f backend/Dockerfile.lambda -t $RepoName backend/

Write-Host "4. Pushing image to ECR..."
docker tag $RepoName`:latest $ImageUri
docker push $ImageUri

Write-Host "5. Creating or updating Lambda Function..."
aws lambda get-function --function-name $FunctionName --region $Region 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Updating existing function code..."
    aws lambda update-function-code --function-name $FunctionName --image-uri $ImageUri --region $Region
} else {
    Write-Host "Creating new Lambda function: $FunctionName..."
    $RoleArn = (aws iam get-role --role-name autoanalytix-lambda-role --query Role.Arn --output text 2>$null)
    if (-not $RoleArn) {
        $RoleArn = (aws iam get-role --role-name aditya-portfolio-lambda-role --query Role.Arn --output text 2>$null)
    }
    if (-not $RoleArn) {
        $RoleArn = (aws iam get-role --role-name lambda-basic-execution --query Role.Arn --output text 2>$null)
    }
    if (-not $RoleArn) {
        Write-Host "Creating execution role 'autoanalytix-lambda-role'..."
        $TrustPolicy = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
        aws iam create-role --role-name autoanalytix-lambda-role --assume-role-policy-document $TrustPolicy 2>$null
        aws iam attach-role-policy --role-name autoanalytix-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>$null
        Start-Sleep -Seconds 8
        $RoleArn = (aws iam get-role --role-name autoanalytix-lambda-role --query Role.Arn --output text 2>$null)
    }

    aws lambda create-function `
        --function-name $FunctionName `
        --package-type Image `
        --code ImageUri=$ImageUri `
        --role $RoleArn `
        --timeout 60 `
        --memory-size 2048 `
        --ephemeral-storage Size=1024 `
        --region $Region
}

Write-Host "6. Configuring Lambda Function URL with public CORS..."
aws lambda create-function-url-config `
    --function-name $FunctionName `
    --auth-type NONE `
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' `
    --region $Region 2>$null

aws lambda add-permission `
    --function-name $FunctionName `
    --statement-id AllowPublicUrlInvoke `
    --action lambda:InvokeFunctionUrl `
    --principal "*" `
    --function-url-auth-type NONE `
    --region $Region 2>$null

aws lambda add-permission `
    --function-name $FunctionName `
    --statement-id AllowPublicInvoke `
    --action lambda:InvokeFunction `
    --principal "*" `
    --invoked-via-function-url `
    --region $Region 2>$null

$FunctionUrl = (aws lambda get-function-url-config --function-name $FunctionName --region $Region --query FunctionUrl --output text)

Write-Host "Deployment Complete! Public Function URL: $FunctionUrl"
Write-Host "Set this in Vercel: VITE_API_URL=$($FunctionUrl.TrimEnd('/'))/api"
