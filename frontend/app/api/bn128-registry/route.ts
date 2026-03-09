import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

// Use /tmp on Vercel (ephemeral but writable), .data/ locally
const STORE_DIR = process.env.VERCEL
  ? "/tmp"
  : path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "bn128-registry.json");

// Registry: poolAddress → ordered array of BN128 commitment strings
// Array index = leaf index in the BN128 Merkle tree
type Registry = Record<string, string[]>;

async function loadRegistry(): Promise<Registry> {
  try {
    const data = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveRegistry(reg: Registry) {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(reg, null, 2));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pool = searchParams.get("pool");
  const reg = await loadRegistry();
  if (pool) {
    return NextResponse.json(reg[pool] ?? []);
  }
  return NextResponse.json(reg);
}

export async function POST(req: Request) {
  const { poolAddress, bn128Commitment } = await req.json();
  if (!poolAddress || !bn128Commitment) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const reg = await loadRegistry();
  if (!reg[poolAddress]) reg[poolAddress] = [];
  // Avoid duplicates
  if (!reg[poolAddress].includes(bn128Commitment)) {
    reg[poolAddress].push(bn128Commitment);
    await saveRegistry(reg);
  }
  const leafIndex = reg[poolAddress].indexOf(bn128Commitment);
  return NextResponse.json({ ok: true, leafIndex });
}
