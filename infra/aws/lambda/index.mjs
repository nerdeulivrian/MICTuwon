// ============================================================================
// tuwon-api — payload fetch Lambda (behind a Function URL)
// ----------------------------------------------------------------------------
// The producer-side read API the student player calls. Two routes:
//
//   GET /sessions          → catalog of lightweight SessionSummary[] (Library)
//   GET /sessions/{id}      → the full Payload JSON for one session
//
// Backing store: DynamoDB table `tuwon-sessions` — one item per session,
// { sessionId (PK, S), payload (S = JSON string) }. Summaries are derived from
// the stored payload so the payload stays the single source of truth.
//
// Runtime: nodejs22.x. We use ONLY @aws-sdk/client-dynamodb (the low-level
// client guaranteed bundled in the runtime) — payload is a plain JSON string
// attribute, so no DocumentClient / lib-dynamodb marshalling is needed.
//
// Invoked via a Lambda Function URL (payload format 2.0): method comes from
// event.requestContext.http.method, path from event.rawPath.
// ============================================================================
import { DynamoDBClient, GetItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";

const TABLE = process.env.TABLE_NAME ?? "tuwon-sessions";
const ddb = new DynamoDBClient({});

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

/** Pull the payload object out of a DynamoDB item ({ payload: { S: "<json>" } }). */
function payloadFromItem(item) {
  const raw = item?.payload?.S;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Derive Library card data from a full payload (mirrors loader.ts summarize()). */
function summarize(payload) {
  let questionCount = 0;
  let slideCount = 0;
  for (const b of payload.blocks ?? []) {
    if (b.type === "slide") slideCount++;
    else questionCount++;
  }
  return {
    sessionId: payload.sessionId,
    title: payload.title,
    createdBy: payload.createdBy,
    estimatedMinutes: payload.estimatedMinutes,
    questionCount,
    slideCount,
    icon: payload.icon,
  };
}

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method ?? "GET";
  const rawPath = event?.rawPath ?? "/";
  const segments = rawPath.replace(/\/+$/, "").split("/").filter(Boolean);

  if (method === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (method !== "GET") return json(405, { error: "Method not allowed" });

  try {
    // GET /sessions  → catalog
    if (segments.length === 1 && segments[0] === "sessions") {
      const res = await ddb.send(
        new ScanCommand({
          TableName: TABLE,
          ProjectionExpression: "payload, #s",
          ExpressionAttributeNames: { "#s": "status" }, // `status` is reserved
        })
      );
      const sessions = (res.Items ?? [])
        .map((item) => {
          const payload = payloadFromItem(item);
          if (!payload) return null; // processing/failed items have no payload yet
          return { ...summarize(payload), status: item.status?.S ?? "ready" };
        })
        .filter(Boolean)
        .sort((a, b) => a.title.localeCompare(b.title));
      return json(200, { sessions });
    }

    // GET /sessions/{id}  → full payload
    if (segments.length === 2 && segments[0] === "sessions") {
      const sessionId = decodeURIComponent(segments[1]);
      const res = await ddb.send(
        new GetItemCommand({ TableName: TABLE, Key: { sessionId: { S: sessionId } } })
      );
      const payload = payloadFromItem(res.Item);
      if (!payload) return json(404, { error: `Unknown session: ${sessionId}` });
      return json(200, payload);
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    console.error("tuwon-api error", err);
    return json(500, { error: "Internal error" });
  }
};
