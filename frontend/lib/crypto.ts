import { hash, num } from "starknet";

function randomFelt(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  const hex = "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex;
}

export interface VeilNote {
  nullifier: string;
  secret: string;
  commitment: string;
  nullifierHash: string;
  precommitment: string;
  depositAmount: string;
  timestamp: number;
  // BN128 field values (for ZK circuit / Garaga verification)
  bn128Commitment?: string;
  bn128NullifierHash?: string;
}

export function generateCommitment(depositAmount: bigint): VeilNote {
  const nullifier = randomFelt();
  const secret = randomFelt();

  const nullifierHash = hash.computePoseidonHashOnElements([
    num.toBigInt(nullifier),
  ]);

  const precommitment = hash.computePoseidonHashOnElements([
    num.toBigInt(nullifier),
    num.toBigInt(secret),
  ]);

  const commitment = hash.computePoseidonHashOnElements([
    depositAmount,
    num.toBigInt(precommitment),
  ]);

  return {
    nullifier,
    secret,
    commitment: num.toHex(commitment),
    nullifierHash: num.toHex(nullifierHash),
    precommitment: num.toHex(precommitment),
    depositAmount: depositAmount.toString(),
    timestamp: Date.now(),
  };
}

/**
 * Compute BN128 Poseidon commitment values (for the ZK circuit).
 * These differ from Starknet Poseidon because the BN128 field is ~254 bits
 * vs Starknet's ~251 bits — same preimage, different hash outputs.
 */
/**
 * Compute BN128 Poseidon commitment values (for the ZK circuit).
 * These differ from Starknet Poseidon because the BN128 field is ~254 bits
 * vs Starknet's ~251 bits — same preimage, different hash outputs.
 */
export async function computeBN128Commitment(
  nullifier: string,
  secret: string,
  depositAmount: bigint
): Promise<{ commitment: string; nullifierHash: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circomlibjs = await import("circomlibjs") as any;
  const poseidon = await circomlibjs.buildPoseidon();
  const F = poseidon.F;

  const nullBigInt = BigInt(nullifier);
  const secretBigInt = BigInt(secret);

  const nullifierHash = F.toString(poseidon([nullBigInt])) as string;
  const precommitment = F.toString(poseidon([nullBigInt, secretBigInt])) as string;
  const commitment = F.toString(poseidon([depositAmount, BigInt(precommitment)])) as string;

  return { commitment, nullifierHash };
}

export function downloadNote(note: VeilNote) {
  const blob = new Blob([JSON.stringify(note, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `veil-note-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- AES-GCM note encryption ---

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password) as BufferSource, "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptAndDownloadNote(note: VeilNote, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(note));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  const payload = {
    encrypted: true,
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext)),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `veil-note-encrypted-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function decryptNote(fileContent: string, password: string): Promise<VeilNote> {
  const payload = JSON.parse(fileContent);
  const salt = new Uint8Array(payload.salt);
  const iv = new Uint8Array(payload.iv);
  const data = new Uint8Array(payload.data);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
