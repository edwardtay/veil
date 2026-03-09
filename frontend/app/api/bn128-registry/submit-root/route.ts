import { NextResponse } from "next/server";
import { operatorInvoke, operatorCall } from "@/lib/operator";

export async function POST(req: Request) {
  const { poolAddress, root } = await req.json();
  if (!poolAddress || !root) {
    return NextResponse.json(
      { error: "missing fields (poolAddress, root)" },
      { status: 400 },
    );
  }

  try {
    const rootBigInt = BigInt(root);
    const rootLow = (rootBigInt & ((1n << 128n) - 1n)).toString();
    const rootHigh = (rootBigInt >> 128n).toString();

    // Fetch actual leaf count from contract (next_index via commitment_count)
    const countResult = await operatorCall(poolAddress, "commitment_count", []);
    const leafCount = Number(countResult[0]);

    console.log(
      `[submit-root] submitting root for pool ${poolAddress.slice(0, 10)}... (leafCount: ${leafCount})`,
    );

    const txHash = await operatorInvoke([
      {
        contractAddress: poolAddress,
        entrypoint: "submit_bn128_root",
        calldata: [rootLow, rootHigh, leafCount.toString()],
      },
    ]);

    console.log(`[submit-root] tx: ${txHash}`);
    return NextResponse.json({ txHash });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "unknown error";
    console.error("[submit-root] failed:", raw);
    const safeMsg = raw.includes("private key")
      ? "Operator key configuration error"
      : raw.includes("already known") || raw.includes("already exists")
        ? "Root already submitted"
        : raw.length > 200
          ? raw.slice(0, 200)
          : raw;
    return NextResponse.json({ error: safeMsg }, { status: 500 });
  }
}
