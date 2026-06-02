# CTE Resume Analyzer — Deployment Guide

## Overview

This project is a full-stack AI-powered resume feedback tool for high school CTE students.
It uses a React frontend hosted on CodeSandbox (or any static host) and an AWS backend
pipeline consisting of S3, API Gateway, Lambda, Textract, Comprehend, Bedrock, Polly,
and DynamoDB.

---

## Repository Structure

```
cte-resume-analyzer/
├── src/
│   ├── App.tsx                      # Root React component
│   ├── styles.css                   # Global styles
│   └── components/
│       ├── UploadForm.tsx           # File upload + submission form
│       └── FeedbackPanel.tsx        # Feedback results display
└── lambda/
    └── lambda_function.py           # AWS Lambda handler (Python 3.12)
```

---

## Prerequisites

- An AWS account with billing activated
- Access to the following AWS services in us-east-1:
  - S3, Lambda, API Gateway, DynamoDB
  - Amazon Textract, Amazon Comprehend
  - Amazon Bedrock (with a Claude model approved)
  - Amazon Polly

---

## Step 1 — S3 Bucket

1. Go to AWS Console → S3 → Create bucket
2. Set bucket name to something unique, e.g. `cte-resume-uploads-yourname`
   > **Note:** Replace `YOUR_S3_BUCKET_NAME` in `lambda_function.py` with this value.
3. Region: `us-east-1`
4. Keep "Block all public access" enabled
5. Click Create bucket

---

## Step 2 — DynamoDB Table

1. Go to AWS Console → DynamoDB → Create table
2. Table name: `cte-feedback`
   > **Note:** Replace `YOUR_DYNAMODB_TABLE_NAME` in `lambda_function.py` with this value.
3. Partition key: `sessionId` (String)
4. Leave sort key empty
5. Settings: Default
6. Click Create table

---

## Step 3 — Lambda Function

### 3-1 Create the function

1. Go to AWS Console → Lambda → Create function
2. Choose "Author from scratch"
3. Function name: `cte-resume-analyzer`
4. Runtime: Python 3.12
5. Architecture: x86_64
6. Click Create function

### 3-2 Attach IAM permissions

1. In the Lambda function page → Configuration → Permissions
2. Click the Role name link (opens IAM)
3. Click Add permissions → Attach policies
4. Search and attach the following policies:
   - `AmazonS3FullAccess`
   - `AmazonDynamoDBFullAccess`
   - `AmazonTextractFullAccess`
   - `ComprehendFullAccess`
   - `AmazonPollyFullAccess`
   - `AmazonBedrockFullAccess`
5. Click Add permissions

### 3-3 Adjust timeout and memory

1. Lambda → Configuration → General configuration → Edit
2. Timeout: `1 min 0 sec`
3. Memory: `512 MB`
4. Click Save

### 3-4 Deploy the code

1. In the Lambda function page → Code tab
2. Open `lambda_function.py`
3. Replace all contents with the code from `lambda/lambda_function.py` in this repo
4. Update the two configuration values at the top of the file:
   ```python
   TABLE_NAME  = "YOUR_DYNAMODB_TABLE_NAME"   # your DynamoDB table name
   BUCKET_NAME = "YOUR_S3_BUCKET_NAME"        # your S3 bucket name
   ```
5. Click Deploy

---

## Step 4 — API Gateway

### 4-1 Create the API

1. Go to AWS Console → API Gateway → Create API
2. Choose REST API → Build
3. API name: `cte-analyzer-api`
4. Click Create API

### 4-2 Create resource and method

1. Actions → Create Resource
2. Resource name: `analyze` (path becomes `/analyze`)
3. Check "Enable API Gateway CORS"
4. Click Create Resource
5. Select `/analyze` → Actions → Create Method → POST → confirm
6. Integration type: Lambda Function
7. Check "Use Lambda Proxy integration"
8. Lambda Function: `cte-resume-analyzer`
9. Click Save → OK

### 4-3 Deploy the API

1. Actions → Deploy API
2. Stage: New Stage → name it `prod`
3. Click Deploy
4. Copy the Invoke URL shown at the top — it looks like:
   ```
   https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod
   ```
   > **Note:** Your full API endpoint will be this URL + `/analyze`

---

## Step 5 — Bedrock Model Access

1. Go to AWS Console → Bedrock → Model catalog
2. Search for "Claude" and find an active model
3. Open the model page and click "Submit use case details" if prompted
   (Write something like: "Educational tool to help high school CTE students improve their resumes.")
4. Wait a few minutes for approval
5. Note the Model ID shown on the page, e.g.:
   ```
   us.anthropic.claude-haiku-4-5-20251001-v1:0
   ```
   > **Note:** Update the `modelId` field in `lambda_function.py` if different from above,
   > then redeploy.

---

## Step 6 — Frontend Configuration

1. Open `src/components/UploadForm.tsx`
2. Find the `API_URL` constant at the top and replace it with your Invoke URL + `/analyze`:
   ```ts
   const API_URL = "https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod/analyze";
   ```
3. Save the file



## Troubleshooting

| Error | Likely Cause | Fix |
|---|---|---|
| `Failed to fetch` | CORS not configured | Enable CORS on API Gateway, redeploy |
| `SubscriptionRequiredException` | AWS service not activated | Complete AWS account setup and wait for activation |
| `ResourceNotFoundException` on Bedrock | Model ID is legacy or wrong | Check Model catalog for an active model ID |
| `ValidationException` on Bedrock | Model requires inference profile | Prefix model ID with `us.` |
| `Expecting value` JSON error | Claude returned extra text | The strip logic in the code handles this automatically |
| `Error: 'body'` in Lambda | Lambda Proxy Integration not enabled | Enable it in API Gateway → Integration Request |

---

## AWS Services Used

| Service | Purpose |
|---|---|
| Amazon S3 | Store uploaded PDF files |
| Amazon API Gateway | Expose HTTP endpoint to frontend |
| AWS Lambda | Orchestrate the AI pipeline |
| Amazon Textract | Extract structured text from PDF |
| Amazon Comprehend | NLP key phrase extraction |
| Amazon Bedrock + Claude | Score and generate feedback |
| Amazon Polly | Convert feedback text to audio |
| Amazon DynamoDB | Persist feedback sessions |
