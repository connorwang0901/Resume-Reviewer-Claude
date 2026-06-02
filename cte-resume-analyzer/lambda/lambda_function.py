import json
import boto3
import uuid
import base64
from datetime import datetime

s3         = boto3.client("s3")
textract   = boto3.client("textract")
comprehend = boto3.client("comprehend")
bedrock    = boto3.client("bedrock-runtime", region_name="us-east-1")
polly      = boto3.client("polly")
dynamodb   = boto3.resource("dynamodb")

# ---------------------------------------------------------------
# CONFIGURE: Replace with your own values
# ---------------------------------------------------------------
TABLE_NAME  = "YOUR_DYNAMODB_TABLE_NAME"   # e.g. "cte-feedback"
BUCKET_NAME = "YOUR_S3_BUCKET_NAME"        # e.g. "cte-resume-uploads-yourname"

SYSTEM_PROMPT = """You are a supportive career counselor helping high school students
in Career and Technical Education (CTE) programs improve their resumes and cover letters.

Your goal is NOT to filter or reject — it is to encourage and guide.
Always use positive, constructive language appropriate for a high school student aged 14-18.

When given a resume or cover letter, analyze it and return a JSON object with exactly this structure:
{
  "document_type": "resume" or "cover_letter",
  "overall_score": <integer 1-10>,
  "dimensions": {
    "clarity":        { "score": <1-10>, "comment": "<1 sentence>" },
    "action_verbs":   { "score": <1-10>, "comment": "<1 sentence>" },
    "cte_relevance":  { "score": <1-10>, "comment": "<1 sentence>" },
    "formatting":     { "score": <1-10>, "comment": "<1 sentence>" },
    "completeness":   { "score": <1-10>, "comment": "<1 sentence>" }
  },
  "suggestions": [
    "<specific, actionable suggestion 1>",
    "<specific, actionable suggestion 2>",
    "<specific, actionable suggestion 3>"
  ],
  "encouragement": "<1-2 sentences of genuine positive reinforcement>"
}

Return ONLY the JSON object. No preamble, no markdown code fences."""


def lambda_handler(event, context):
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        raw_body = event.get("body") or "{}"
        body = json.loads(raw_body)

        pdf_base64 = body["pdf_base64"]
        doc_type   = body.get("document_type", "resume")
        student_id = body.get("student_id", "anonymous")

        pdf_bytes = base64.b64decode(pdf_base64)

        # 1. Upload PDF to S3
        file_key = f"uploads/{student_id}/{uuid.uuid4()}.pdf"
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=file_key,
            Body=pdf_bytes,
            ContentType="application/pdf"
        )

        # 2. Extract text with Textract
        textract_resp = textract.detect_document_text(
            Document={"S3Object": {"Bucket": BUCKET_NAME, "Name": file_key}}
        )
        extracted_text = " ".join(
            block["Text"]
            for block in textract_resp["Blocks"]
            if block["BlockType"] == "LINE"
        )
        print("Extracted text length:", len(extracted_text))

        # 3. NLP analysis with Comprehend
        comprehend_resp = comprehend.detect_key_phrases(
            Text=extracted_text[:5000],
            LanguageCode="en"
        )
        key_phrases = [p["Text"] for p in comprehend_resp["KeyPhrases"][:20]]
        print("Key phrases:", key_phrases)

        # 4. Score and suggest with Bedrock + Claude
        user_prompt = f"""Please analyze the following {doc_type}.

Key phrases detected: {", ".join(key_phrases)}

--- BEGIN DOCUMENT ---
{extracted_text[:8000]}
--- END DOCUMENT ---"""

        bedrock_resp = bedrock.invoke_model(
            # ---------------------------------------------------------------
            # CONFIGURE: Use a currently active Claude model inference profile
            # Format for cross-region: us.anthropic.MODEL_ID
            # Check available models at: AWS Console > Bedrock > Model catalog
            # ---------------------------------------------------------------
            modelId="us.anthropic.claude-haiku-4-5-20251001-v1:0",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1024,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_prompt}],
            }),
        )
        result_text = json.loads(bedrock_resp["body"].read())["content"][0]["text"]
        print("Bedrock raw output:", result_text)

        result_text = result_text.strip().strip("```json").strip("```").strip()
        feedback = json.loads(result_text)
        print("Parsed feedback keys:", list(feedback.keys()))

        # 5. Generate audio feedback with Polly
        summary_text = (
            f"Overall score: {feedback['overall_score']} out of 10. "
            f"{feedback['encouragement']} "
            f"Here are your top suggestions: "
            + " ".join(
                f"Suggestion {i+1}: {s}"
                for i, s in enumerate(feedback["suggestions"])
            )
        )
        polly_resp = polly.synthesize_speech(
            Text=summary_text,
            OutputFormat="mp3",
            VoiceId="Joanna"
        )
        audio_bytes  = polly_resp["AudioStream"].read()
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

        # 6. Save session to DynamoDB
        session_id = str(uuid.uuid4())
        table = dynamodb.Table(TABLE_NAME)
        table.put_item(Item={
            "sessionId":    session_id,
            "studentId":    student_id,
            "documentType": doc_type,
            "overallScore": feedback["overall_score"],
            "feedback":     json.dumps(feedback),
            "fileKey":      file_key,
            "createdAt":    datetime.utcnow().isoformat(),
        })

        # 7. Return result to frontend
        feedback["audio_base64"] = audio_base64
        feedback["session_id"]   = session_id

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps(feedback),
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": str(e)}),
        }
