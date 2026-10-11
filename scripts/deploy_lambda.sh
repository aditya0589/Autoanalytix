#!/usr/bin/env bash
set -e

REGION="${1:-us-east-1}"
REPO_NAME="${2:-autoanalytix-backend}"
FUNCTION_NAME="${3:-autoanalytix-backend}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$ACCOUNT_ID" ]; then
    echo "Error: Failed to obtain AWS Account ID. Please ensure AWS CLI is configured." >&2
    exit 1
fi

ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
IMAGE_URI="$ECR_URI/$REPO_NAME:latest"

echo "1. Authenticating with ECR..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_URI"

echo "2. Ensuring ECR repository exists..."
if ! aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo "Creating ECR repository: $REPO_NAME"
    aws ecr create-repository --repository-name "$REPO_NAME" --region "$REGION"
fi

echo "3. Building Docker container for linux/amd64..."
docker build --platform linux/amd64 -f backend/Dockerfile.lambda -t "$REPO_NAME" backend/

echo "4. Pushing image to ECR..."
docker tag "$REPO_NAME:latest" "$IMAGE_URI"
docker push "$IMAGE_URI"

echo "5. Creating or updating Lambda Function..."
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo "Updating existing function code..."
    aws lambda update-function-code --function-name "$FUNCTION_NAME" --image-uri "$IMAGE_URI" --region "$REGION"
else
    echo "Creating new Lambda function: $FUNCTION_NAME..."
    ROLE_ARN=$(aws iam get-role --role-name autoanalytix-lambda-role --query Role.Arn --output text 2>/dev/null || true)
    if [ -z "$ROLE_ARN" ] || [ "$ROLE_ARN" = "None" ]; then
        ROLE_ARN=$(aws iam get-role --role-name aditya-portfolio-lambda-role --query Role.Arn --output text 2>/dev/null || true)
    fi
    if [ -z "$ROLE_ARN" ] || [ "$ROLE_ARN" = "None" ]; then
        ROLE_ARN=$(aws iam get-role --role-name lambda-basic-execution --query Role.Arn --output text 2>/dev/null || true)
    fi
    if [ -z "$ROLE_ARN" ] || [ "$ROLE_ARN" = "None" ]; then
        echo "Creating execution role autoanalytix-lambda-role..."
        TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
        aws iam create-role --role-name autoanalytix-lambda-role --assume-role-policy-document "$TRUST_POLICY" 2>/dev/null || true
        aws iam attach-role-policy --role-name autoanalytix-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true
        sleep 8
        ROLE_ARN=$(aws iam get-role --role-name autoanalytix-lambda-role --query Role.Arn --output text)
    fi

    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --package-type Image \
        --code ImageUri="$IMAGE_URI" \
        --role "$ROLE_ARN" \
        --timeout 60 \
        --memory-size 2048 \
        --ephemeral-storage Size=1024 \
        --region "$REGION"
fi

echo "6. Configuring Lambda Function URL (CORS managed by FastAPI)..."
aws lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type NONE \
    --cors '{}' \
    --region "$REGION" 2>/dev/null || true

aws lambda update-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --cors '{}' \
    --region "$REGION" 2>/dev/null || true

aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id AllowPublicUrlInvoke \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region "$REGION" 2>/dev/null || true

aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id AllowPublicInvoke \
    --action lambda:InvokeFunction \
    --principal "*" \
    --invoked-via-function-url \
    --region "$REGION" 2>/dev/null || true

FUNCTION_URL=$(aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" --query FunctionUrl --output text)

echo "Deployment Complete! Public Function URL: $FUNCTION_URL"
TRIMMED_URL="${FUNCTION_URL%/}"
echo "Set this in Vercel: VITE_API_URL=${TRIMMED_URL}/api"
