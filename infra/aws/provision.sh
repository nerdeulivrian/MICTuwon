#!/usr/bin/env bash
# ============================================================================
# provision.sh — stand up the tuwon backend (Phase 6) as the tuwon-dev user.
# ----------------------------------------------------------------------------
# Idempotent: safe to re-run. Each step checks for existence before creating,
# and updates in place where it can. Everything is pinned to ap-southeast-1 and
# named `tuwon-*` so it stays inside the tuwon-dev policy's blast radius.
#
# Provisions:
#   1. S3 bucket          tuwon-assets-<acct>     (public-read + CORS; Phase 7 writes here)
#   2. DynamoDB table     tuwon-sessions          (sessionId PK), seeded from seed/*.json
#   3. IAM role           tuwon-api-exec          (boundary-stamped; reads the table)
#   4. Lambda             tuwon-api               (nodejs22.x) + Function URL (public)
#
# Requires: awscli v2, jq, zip. Run from infra/aws/.
# ============================================================================
set -euo pipefail

REGION="ap-southeast-1"
ACCOUNT_ID="174508893991"
BUCKET="tuwon-assets-sg-${ACCOUNT_ID}"
TABLE="tuwon-sessions"
ROLE="tuwon-api-exec"
FUNCTION="tuwon-api"
BOUNDARY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/tuwon-boundary"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

aws() { command aws --region "$REGION" "$@"; }
log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()  { printf '  \033[0;32m✓ %s\033[0m\n' "$*"; }

# ── 1. S3 bucket ────────────────────────────────────────────────────────────
log "S3 bucket: $BUCKET"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  ok "bucket exists"
else
  # Regions other than us-east-1 MUST pass a matching LocationConstraint.
  aws s3api create-bucket --bucket "$BUCKET" \
    --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  ok "created"
fi

# Assets are public-read (payload stores full https URLs the player GETs directly).
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" >/dev/null
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadAssets",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET}/*"
  }]
}
JSON
)" >/dev/null
ok "public-read policy applied"

aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$(cat <<JSON
{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}
JSON
)" >/dev/null
ok "CORS applied"

# ── 2. DynamoDB table ───────────────────────────────────────────────────────
log "DynamoDB table: $TABLE"
if aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  ok "table exists"
else
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=sessionId,AttributeType=S \
    --key-schema AttributeName=sessionId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST >/dev/null
  ok "created (PAY_PER_REQUEST)"
  aws dynamodb wait table-exists --table-name "$TABLE"
  ok "active"
fi

log "Seeding payloads"
for f in "$HERE"/seed/*.json; do
  sid="$(jq -r '.sessionId' "$f")"
  payload="$(jq -c '.' "$f")"
  # Store the whole payload as a single JSON string attribute.
  aws dynamodb put-item --table-name "$TABLE" --item "$(jq -n \
    --arg sid "$sid" --arg payload "$payload" \
    '{sessionId: {S: $sid}, payload: {S: $payload}}')" >/dev/null
  ok "put $sid"
done

# ── 3. Execution role (boundary-stamped) ────────────────────────────────────
log "IAM role: $ROLE"
if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  ok "role exists"
else
  aws iam create-role \
    --role-name "$ROLE" \
    --assume-role-policy-document "file://${HERE}/lambda-trust-policy.json" \
    --permissions-boundary "$BOUNDARY_ARN" \
    --tags Key=project,Value=tuwon >/dev/null
  ok "created (boundary: tuwon-boundary)"
fi
# Inline read policy for the sessions table (idempotent put).
aws iam put-role-policy \
  --role-name "$ROLE" \
  --policy-name tuwon-api-read \
  --policy-document "file://${HERE}/tuwon-api-exec-inline.json" >/dev/null
ok "read policy attached"
ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query 'Role.Arn' --output text)"

# ── 4. Lambda + Function URL ────────────────────────────────────────────────
log "Packaging Lambda"
ZIP="$(mktemp -t tuwon-api).zip"
(cd "$HERE/lambda" && zip -q -j "$ZIP" index.mjs)
ok "zipped index.mjs"

log "Lambda function: $FUNCTION"
if aws lambda get-function --function-name "$FUNCTION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNCTION" --zip-file "fileb://${ZIP}" >/dev/null
  ok "code updated"
  aws lambda wait function-updated --function-name "$FUNCTION"
  aws lambda update-function-configuration \
    --function-name "$FUNCTION" \
    --environment "Variables={TABLE_NAME=${TABLE}}" \
    --timeout 10 --memory-size 256 >/dev/null
  ok "config updated"
else
  # IAM role propagation can lag creation; retry create a few times.
  for attempt in 1 2 3 4 5; do
    if aws lambda create-function \
      --function-name "$FUNCTION" \
      --runtime nodejs22.x \
      --role "$ROLE_ARN" \
      --handler index.handler \
      --timeout 10 --memory-size 256 \
      --environment "Variables={TABLE_NAME=${TABLE}}" \
      --zip-file "fileb://${ZIP}" >/dev/null 2>/tmp/tuwon-lambda-err; then
      ok "created (nodejs22.x)"
      break
    fi
    if grep -q "cannot be assumed by Lambda\|not authorized to perform: iam:PassRole\|InvalidParameterValueException" /tmp/tuwon-lambda-err && [ "$attempt" -lt 5 ]; then
      echo "  …role not ready, retry $attempt/5"; sleep 6
    else
      cat /tmp/tuwon-lambda-err; exit 1
    fi
  done
fi
aws lambda wait function-active-v2 --function-name "$FUNCTION" 2>/dev/null || true

log "Function URL (public)"
if aws lambda get-function-url-config --function-name "$FUNCTION" >/dev/null 2>&1; then
  ok "URL config exists"
else
  aws lambda create-function-url-config \
    --function-name "$FUNCTION" \
    --auth-type NONE \
    --cors "AllowOrigins=*,AllowMethods=GET,AllowHeaders=content-type" >/dev/null
  ok "URL created"
fi
# Public invoke permissions for the Function URL (idempotent). Since Oct 2025,
# a NONE-auth function URL needs BOTH lambda:InvokeFunctionUrl AND
# lambda:InvokeFunction (via the InvokedViaFunctionUrl condition) — granting
# only the first returns 403 even with AuthType NONE.
aws lambda add-permission \
  --function-name "$FUNCTION" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE >/dev/null 2>&1 && ok "InvokeFunctionUrl permission added" || ok "InvokeFunctionUrl permission present"
aws lambda add-permission \
  --function-name "$FUNCTION" \
  --statement-id FunctionURLInvokeAllowPublicAccess \
  --action lambda:InvokeFunction \
  --principal "*" \
  --invoked-via-function-url >/dev/null 2>&1 && ok "InvokeFunction permission added" || ok "InvokeFunction permission present"

FURL="$(aws lambda get-function-url-config --function-name "$FUNCTION" --query 'FunctionUrl' --output text)"
rm -f "$ZIP"

# ── Summary ──────────────────────────────────────────────────────────────────
log "Done. Backend is live."
printf '  S3 bucket    : %s\n' "$BUCKET"
printf '  Asset base   : https://%s.s3.%s.amazonaws.com/\n' "$BUCKET" "$REGION"
printf '  DynamoDB     : %s (seeded)\n' "$TABLE"
printf '  Lambda       : %s (nodejs22.x)\n' "$FUNCTION"
printf '  API base URL : %s\n' "${FURL%/}"
printf '\n  Try:\n'
printf '    curl %ssessions\n' "$FURL"
printf '    curl %ssessions/demo-quiz\n' "$FURL"
