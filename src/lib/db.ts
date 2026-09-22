// Two backends behind one small query surface:
//  - a Postgres connection string is set -> real Postgres (the shared team
//    database, via `pg`)
//  - none set -> a local SQLite file (Node's built-in node:sqlite), so
//    `npm install && npm run dev` works with zero setup, same as chop-shop.
// Everything outside this file only calls the functions below — the
// Postgres/SQLite dialect difference (placeholders, timestamp handling)
// lives entirely here.
import path from "node:path";

// Vercel's own "Postgres" storage product is now a Neon integration under
// the hood, and different setup paths (native integration vs. the Neon
// marketplace listing, and whatever custom prefix the connect-to-project
// dialog was given to dodge a naming conflict) have named the injected env
// var differently. Check the common ones rather than betting on exactly one
// name — the "SPLICE_" ones matter because the actual deployed project's
// connection got saved under that prefix.
const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.SPLICE_POSTGRES_URL ||
  process.env.SPLICE_DATABASE_URL ||
  process.env.SPLICE_POSTGRES_PRISMA_URL ||
  process.env.SPLICE_DATABASE_URL_UNPOOLED;

export type Platform = "youtube" | "vimeo" | "other";
export type EntryStatus = "queued" | "downloading" | "ready" | "error";
export type MontageStatus = "idle" | "processing" | "ready" | "error";

export interface Project {
  id: string;
  name: string;
  clientTag: string | null;
  createdAt: number;
  updatedAt: number;
  montageStatus: MontageStatus;
  montageGifUrl: string | null;
  montageUpdatedAt: number | null;
}

export interface Entry {
  id: string;
  projectId: string;
  sourceUrl: string;
  platform: Platform;
  title: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  snippetStartSeconds: number | null;
  snippetLengthSeconds: number;
  clipUrl: string | null;
  gifUrl: string | null;
  status: EntryStatus;
  errorMessage: string | null;
  createdAt: number;
}

const usingPostgres = Boolean(POSTGRES_URL);

// ---- schema (same shape expressed twice, once per dialect) ----------------

const PG_SCHEMA = `
create table if not exists projects (
  id text primary key,
  name text not null,
  client_tag text,
  created_at bigint not null,
  updated_at bigint not null,
  montage_status text not null default 'idle',
  montage_gif_url text,
  montage_updated_at bigint
);
create table if not exists entries (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  source_url text not null,
  platform text not null,
  title text,
  thumbnail_url text,
  duration_seconds double precision,
  snippet_start_seconds double precision,
  snippet_length_seconds double precision not null default 3,
  clip_url text,
  gif_url text,
  status text not null default 'queued',
  error_message text,
  created_at bigint not null
);
create index if not exists entries_project_id_idx on entries(project_id);
`;

const SQLITE_SCHEMA = `
create table if not exists projects (
  id text primary key,
  name text not null,
  client_tag text,
  created_at integer not null,
  updated_at integer not null,
  montage_status text not null default 'idle',
  montage_gif_url text,
  montage_updated_at integer
);
create table if not exists entries (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  source_url text not null,
  platform text not null,
  title text,
  thumbnail_url text,
  duration_seconds real,
  snippet_start_seconds real,
  snippet_length_seconds real not null default 3,
  clip_url text,
  gif_url text,
  status text not null default 'queued',
  error_message text,
  created_at integer not null
);
create index if not exists entries_project_id_idx on entries(project_id);
`;

// ---- row <-> domain mapping -------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProject(r: any): Project {
  return {
    id: r.id,
    name: r.name,
    clientTag: r.client_tag ?? null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    montageStatus: r.montage_status,
    montageGifUrl: r.montage_gif_url ?? null,
    montageUpdatedAt: r.montage_updated_at != null ? Number(r.montage_updated_at) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(r: any): Entry {
  return {
    id: r.id,
    projectId: r.project_id,
    sourceUrl: r.source_url,
    platform: r.platform,
    title: r.title ?? null,
    thumbnailUrl: r.thumbnail_url ?? null,
    durationSeconds: r.duration_seconds != null ? Number(r.duration_seconds) : null,
    snippetStartSeconds: r.snippet_start_seconds != null ? Number(r.snippet_start_seconds) : null,
    snippetLengthSeconds: Number(r.snippet_length_seconds),
    clipUrl: r.clip_url ?? null,
    gifUrl: r.gif_url ?? null,
    status: r.status,
    errorMessage: r.error_message ?? null,
    createdAt: Number(r.created_at),
  };
}

// ---- Postgres backend -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pgPoolPromise: Promise<any> | null = null;

async function getPgPool() {
  if (!pgPoolPromise) {
    pgPoolPromise = (async () => {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: POSTGRES_URL });
      await pool.query(PG_SCHEMA);
      return pool;
    })();
  }
  return pgPoolPromise;
}

// ---- SQLite backend (local dev default) -------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqliteDb: any = null;

async function getSqliteDb() {
  if (!sqliteDb) {
    const { DatabaseSync } = await import("node:sqlite");
    const file = path.join(process.cwd(), "splice-local.sqlite");
    sqliteDb = new DatabaseSync(file);
    sqliteDb.exec("pragma foreign_keys = on;");
    sqliteDb.exec(SQLITE_SCHEMA);
  }
  return sqliteDb;
}

// ---- public API --------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  if (usingPostgres) {
    const pool = await getPgPool();
    const { rows } = await pool.query("select * from projects order by updated_at desc");
    return rows.map(rowToProject);
  }
  const db = await getSqliteDb();
  const rows = db.prepare("select * from projects order by updated_at desc").all();
  return rows.map(rowToProject);
}

export async function createProject(name: string, clientTag: string | null): Promise<Project> {
  const id = crypto.randomUUID();
  const now = Date.now();
  if (usingPostgres) {
    const pool = await getPgPool();
    await pool.query(
      "insert into projects (id, name, client_tag, created_at, updated_at) values ($1,$2,$3,$4,$5)",
      [id, name, clientTag, now, now]
    );
  } else {
    const db = await getSqliteDb();
    db.prepare(
      "insert into projects (id, name, client_tag, created_at, updated_at) values (?,?,?,?,?)"
    ).run(id, name, clientTag, now, now);
  }
  return { id, name, clientTag, createdAt: now, updatedAt: now, montageStatus: "idle", montageGifUrl: null, montageUpdatedAt: null };
}

export async function getProject(id: string): Promise<Project | undefined> {
  if (usingPostgres) {
    const pool = await getPgPool();
    const { rows } = await pool.query("select * from projects where id = $1", [id]);
    return rows[0] ? rowToProject(rows[0]) : undefined;
  }
  const db = await getSqliteDb();
  const row = db.prepare("select * from projects where id = ?").get(id);
  return row ? rowToProject(row) : undefined;
}

export async function deleteProject(id: string): Promise<void> {
  if (usingPostgres) {
    const pool = await getPgPool();
    await pool.query("delete from projects where id = $1", [id]);
  } else {
    const db = await getSqliteDb();
    db.prepare("delete from entries where project_id = ?").run(id);
    db.prepare("delete from projects where id = ?").run(id);
  }
}

export async function touchProject(id: string): Promise<void> {
  const now = Date.now();
  if (usingPostgres) {
    const pool = await getPgPool();
    await pool.query("update projects set updated_at = $1 where id = $2", [now, id]);
  } else {
    const db = await getSqliteDb();
    db.prepare("update projects set updated_at = ? where id = ?").run(now, id);
  }
}

export async function setProjectMontage(
  id: string,
  fields: Partial<Pick<Project, "montageStatus" | "montageGifUrl" | "montageUpdatedAt">>
): Promise<void> {
  // Each field is only touched if the caller actually passed it — setting
  // montageStatus alone (e.g. flipping to "processing") must not clobber an
  // existing montageGifUrl that wasn't mentioned.
  const columnFor = {
    montageStatus: "montage_status",
    montageGifUrl: "montage_gif_url",
    montageUpdatedAt: "montage_updated_at",
  } as const;
  const keys = (Object.keys(fields) as (keyof typeof columnFor)[]).filter((k) => fields[k] !== undefined);
  if (keys.length === 0) return;

  if (usingPostgres) {
    const pool = await getPgPool();
    const setClauses = keys.map((k, i) => `${columnFor[k]} = $${i + 1}`);
    const values = keys.map((k) => fields[k]);
    await pool.query(`update projects set ${setClauses.join(", ")} where id = $${keys.length + 1}`, [
      ...values,
      id,
    ]);
  } else {
    const db = await getSqliteDb();
    const setClauses = keys.map((k) => `${columnFor[k]} = ?`);
    const values = keys.map((k) => fields[k]);
    db.prepare(`update projects set ${setClauses.join(", ")} where id = ?`).run(...values, id);
  }
}

export async function listEntries(projectId: string): Promise<Entry[]> {
  if (usingPostgres) {
    const pool = await getPgPool();
    const { rows } = await pool.query(
      "select * from entries where project_id = $1 order by created_at asc",
      [projectId]
    );
    return rows.map(rowToEntry);
  }
  const db = await getSqliteDb();
  const rows = db.prepare("select * from entries where project_id = ? order by created_at asc").all(projectId);
  return rows.map(rowToEntry);
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  if (usingPostgres) {
    const pool = await getPgPool();
    const { rows } = await pool.query("select * from entries where id = $1", [id]);
    return rows[0] ? rowToEntry(rows[0]) : undefined;
  }
  const db = await getSqliteDb();
  const row = db.prepare("select * from entries where id = ?").get(id);
  return row ? rowToEntry(row) : undefined;
}

export async function insertEntry(input: {
  projectId: string;
  sourceUrl: string;
  platform: Platform;
  snippetLengthSeconds: number;
}): Promise<Entry> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const entry: Entry = {
    id,
    projectId: input.projectId,
    sourceUrl: input.sourceUrl,
    platform: input.platform,
    title: null,
    thumbnailUrl: null,
    durationSeconds: null,
    snippetStartSeconds: null,
    snippetLengthSeconds: input.snippetLengthSeconds,
    clipUrl: null,
    gifUrl: null,
    status: "queued",
    errorMessage: null,
    createdAt: now,
  };
  if (usingPostgres) {
    const pool = await getPgPool();
    await pool.query(
      `insert into entries (id, project_id, source_url, platform, snippet_length_seconds, status, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [id, entry.projectId, entry.sourceUrl, entry.platform, entry.snippetLengthSeconds, entry.status, now]
    );
  } else {
    const db = await getSqliteDb();
    db.prepare(
      `insert into entries (id, project_id, source_url, platform, snippet_length_seconds, status, created_at)
       values (?,?,?,?,?,?,?)`
    ).run(id, entry.projectId, entry.sourceUrl, entry.platform, entry.snippetLengthSeconds, entry.status, now);
  }
  return entry;
}

export async function updateEntry(
  id: string,
  fields: Partial<
    Pick<
      Entry,
      | "title"
      | "thumbnailUrl"
      | "durationSeconds"
      | "snippetStartSeconds"
      | "clipUrl"
      | "gifUrl"
      | "status"
      | "errorMessage"
    >
  >
): Promise<void> {
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return;
  const columnFor: Record<string, string> = {
    title: "title",
    thumbnailUrl: "thumbnail_url",
    durationSeconds: "duration_seconds",
    snippetStartSeconds: "snippet_start_seconds",
    clipUrl: "clip_url",
    gifUrl: "gif_url",
    status: "status",
    errorMessage: "error_message",
  };
  if (usingPostgres) {
    const pool = await getPgPool();
    const setClauses = keys.map((k, i) => `${columnFor[k]} = $${i + 1}`);
    const values = keys.map((k) => fields[k]);
    await pool.query(`update entries set ${setClauses.join(", ")} where id = $${keys.length + 1}`, [
      ...values,
      id,
    ]);
  } else {
    const db = await getSqliteDb();
    const setClauses = keys.map((k) => `${columnFor[k]} = ?`);
    const values = keys.map((k) => fields[k]);
    db.prepare(`update entries set ${setClauses.join(", ")} where id = ?`).run(...values, id);
  }
}

export async function deleteEntry(id: string): Promise<void> {
  if (usingPostgres) {
    const pool = await getPgPool();
    await pool.query("delete from entries where id = $1", [id]);
  } else {
    const db = await getSqliteDb();
    db.prepare("delete from entries where id = ?").run(id);
  }
}
