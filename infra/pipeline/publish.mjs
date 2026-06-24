// ============================================================================
// publish.mjs — the PUBLISH stage (S3 upload + assemble + seed + DynamoDB)
// ----------------------------------------------------------------------------
// Uploads the locally-generated assets to S3, assembles the player payload from
// the now-live URLs, validates it (every asset an absolute https URL), writes a
// reproducible seed file, and put-items it into DynamoDB with a `status`.
// Uses the ambient tuwon-dev AWS creds via the aws CLI (like generate.mjs).
// ============================================================================
import { writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assemble, validatePayload } from "./assemble.mjs";
import { paths } from "./media.mjs";
import { step, ok } from "./util.mjs";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = resolve(HERE, "..", "aws", "seed");

// AWS facts (match infra/aws/provision.sh).
const REGION = "ap-southeast-1";
const ACCOUNT_ID = "174508893991";
const BUCKET = `tuwon-assets-sg-${ACCOUNT_ID}`;
const TABLE = "tuwon-sessions";
const PUBLIC_BASE = `https://${BUCKET}.s3.${REGION}.amazonaws.com`;

const aws = (args) => execFileP("aws", ["--region", REGION, ...args], { maxBuffer: 64 * 1024 * 1024 });

async function s3Put(localPath, key, contentType) {
  await aws(["s3api", "put-object", "--bucket", BUCKET, "--key", key, "--body", localPath, "--content-type", contentType]);
}

async function uploadDir(dir, prefix, contentType) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const f of await readdir(dir)) {
    const p = resolve(dir, f);
    if (!(await stat(p)).isFile()) continue;
    await s3Put(p, `${prefix}/${f}`, contentType);
    n++;
  }
  return n;
}

/**
 * Publish a normalized draft whose media is already on disk.
 * @returns the assembled, validated payload.
 */
export async function publish(ndraft) {
  const id = ndraft.sessionId;
  const s3Prefix = `sessions/${id}`;

  // 1. Upload every generated asset.
  step(`publish: upload assets → s3://${BUCKET}/${s3Prefix}/`);
  const a = await uploadDir(paths.audioDir(id), `${s3Prefix}/audio`, "audio/wav");
  const im = await uploadDir(paths.imageDir(id), `${s3Prefix}/image`, "image/png");
  ok(`uploaded ${a} audio · ${im} image`);

  // 2. Assemble from the now-live URLs (keys match media.mjs file names).
  const audioUrl = (key) => `${PUBLIC_BASE}/${s3Prefix}/audio/${key}.wav`;
  const imageUrl = (key) => `${PUBLIC_BASE}/${s3Prefix}/image/${key}.png`;
  const payload = assemble(ndraft, { audioUrl, imageUrl });

  // 3. Validate (shape + all asset URLs absolute https).
  validatePayload(payload);
  ok("payload validated (shape + all asset URLs absolute https)");

  // 4. Reproducible seed file alongside the AWS seeds.
  await writeFile(resolve(SEED_DIR, `${id}.json`), JSON.stringify(payload, null, 2));
  ok(`wrote seed → infra/aws/seed/${id}.json`);

  // 5. put-item into DynamoDB with status=ready.
  const item = JSON.stringify({
    sessionId: { S: id },
    payload: { S: JSON.stringify(payload) },
    status: { S: "ready" },
  });
  await aws(["dynamodb", "put-item", "--table-name", TABLE, "--item", item]);
  ok(`put-item → ${TABLE} (sessionId=${id}, status=ready)`);

  return payload;
}

/** Write just a status marker for a session (used for processing/failed states). */
export async function putStatus(sessionId, status) {
  // Update the status attribute without clobbering an existing payload.
  await aws([
    "dynamodb", "update-item",
    "--table-name", TABLE,
    "--key", JSON.stringify({ sessionId: { S: sessionId } }),
    "--update-expression", "SET #s = :s",
    "--expression-attribute-names", JSON.stringify({ "#s": "status" }),
    "--expression-attribute-values", JSON.stringify({ ":s": { S: status } }),
  ]);
}
