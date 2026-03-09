"use client";

import { useState, useEffect } from "react";

export function useBtcPrice() {
  const [price, setPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const data = await res.json();
        if (!cancelled && data?.bitcoin?.usd) {
          setPrice(data.bitcoin.usd);
        }
      } catch {
        // silently fail — price stays 0
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000); // refresh every 60s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { price, isLoading };
}
