import { NextResponse } from "next/server";
import { operatorInvoke } from "@/lib/operator";

/**
 * Privacy relayer: submits withdraw_with_proof on behalf of the user.
 * The on-chain tx sender is the relayer (operator), NOT the user's wallet.
 * This breaks the on-chain link between the user's address and the withdrawal.
 */
export async function POST(req: Request) {
  const { poolAddress, nullifierHash, recipient, proofCalldata } =
    await req.json();
  if (!poolAddress || !nullifierHash || !recipient || !proofCalldata) {
    return NextResponse.json(
      {
        error:
          "missing fields (poolAddress, nullifierHash, recipient, proofCalldata)",
      },
      { status: 400 },
    );
  }

  try {
    const nullBigInt = BigInt(nullifierHash);
    const nullLow = (nullBigInt & ((1n << 128n) - 1n)).toString();
    const nullHigh = (nullBigInt >> 128n).toString();

    console.log(
      `[relay-withdraw] submitting via relayer (${proofCalldata.length} proof felts)`,
    );

    const txHash = await operatorInvoke([
      {
        contractAddress: poolAddress,
        entrypoint: "withdraw_with_proof",
        calldata: [
          nullLow,
          nullHigh,
          recipient,
          proofCalldata.length.toString(),
          ...proofCalldata,
        ],
      },
    ]);

    console.log(`[relay-withdraw] tx: ${txHash}`);
    return NextResponse.json({ txHash });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "unknown error";
    console.error("[relay-withdraw] failed:", raw);
    const safeMsg = raw.includes("private key")
      ? "Operator key configuration error"
      : raw.includes("already spent") || raw.includes("already withdrawn")
        ? "This note was already withdrawn"
        : raw.length > 200
          ? raw.slice(0, 200)
          : raw;
    return NextResponse.json({ error: safeMsg }, { status: 500 });
  }
}
