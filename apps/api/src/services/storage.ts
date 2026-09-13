import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { Env } from "../env.js";

/**
 * Thin wrapper around the S3 SDK: everything the rest of the app needs from object storage, and
 * nothing about buckets/keys leaks past this module. One client is built once per process (see
 * `createStorage`) and carried on `AppBindings`, same as the Drizzle `Database` instance.
 */
export interface Storage {
  readonly enabled: boolean;
  readonly bucket: string;
  ensureBucket(): Promise<void>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  /**
   * Buffers the whole object into memory rather than streaming — simpler and robust across the
   * SDK's differing Node/web stream shapes, and safe because every object here is capped at
   * `STORAGE_MAX_FILE_BYTES` (25 MiB default) on the way in. Returns `null` for a missing key.
   */
  getObject(key: string): Promise<Buffer | null>;
  /** Best-effort batch delete (S3 allows up to 1000 keys per call); never throws for a missing key. */
  deleteObjects(keys: string[]): Promise<void>;
  /** Every key currently in the bucket under `prefix` — used only by reconcileStorage(). */
  listAllKeys(prefix: string): Promise<string[]>;
}

class DisabledStorage implements Storage {
  readonly enabled = false;
  readonly bucket = "";
  async ensureBucket(): Promise<void> {}
  async putObject(): Promise<void> {
    throw new Error("Object storage is not configured (S3_BUCKET unset)");
  }
  async getObject(): Promise<null> {
    return null;
  }
  async deleteObjects(): Promise<void> {}
  async listAllKeys(): Promise<string[]> {
    return [];
  }
}

class S3Storage implements Storage {
  readonly enabled = true;
  constructor(
    private readonly client: S3Client,
    readonly bucket: string,
  ) {}

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      // Covers both "doesn't exist yet" (fresh MinIO volume) and transient head errors on some
      // S3-compatibles that don't implement HeadBucket faithfully; CreateBucket on an
      // already-existing bucket this account owns is a safe no-op on both AWS and MinIO.
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket })).catch((err) => {
        console.error("[storage] failed to ensure bucket exists:", err);
      });
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err: any) {
      if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async deleteObjects(keys: string[]): Promise<void> {
    // S3's DeleteObjects caps at 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }),
      );
    }
  }

  async listAllKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken }),
      );
      for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key);
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }
}

/** For tests that need to exercise the "object storage not configured" (501) path on demand, independent of what the real environment has configured. */
export function createDisabledStorage(): Storage {
  return new DisabledStorage();
}

/** `S3_BUCKET` unset => storage is off entirely; every route that needs it answers 501. */
export function createStorage(env: Env): Storage {
  if (!env.S3_BUCKET) return new DisabledStorage();

  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
  return new S3Storage(client, env.S3_BUCKET);
}

/** Deterministic, never derived from caller-supplied names — see artifact_files.storage_key. */
export function buildStorageKey(orgId: string, artifactId: string, fileId: string): string {
  return `orgs/${orgId}/artifacts/${artifactId}/${fileId}`;
}
