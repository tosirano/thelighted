"use client";

import React, { useState } from "react";

export type StellarAsset = "XLM" | "USDC" | "BITE";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface StellarCheckoutProps {
  items: CartItem[];
  onSuccess?: (txHash: string) => void;
  onCancel?: () => void;
}

const ASSET_DECIMALS: Record<StellarAsset, number> = {
  XLM: 7,
  USDC: 7,
  BITE: 7,
};

function formatAssetAmount(amount: number, asset: StellarAsset): string {
  return amount.toFixed(ASSET_DECIMALS[asset]);
}

function calcTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export default function StellarCheckout({
  items,
  onSuccess,
  onCancel,
}: StellarCheckoutProps) {
  const [asset, setAsset] = useState<StellarAsset>("XLM");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"review" | "confirm" | "done">("review");
  const [txHash, setTxHash] = useState<string | null>(null);

  const total = calcTotal(items);

  async function handleConfirm() {
    setError(null);

    if (!walletAddress.trim()) {
      setError("Please enter your Stellar wallet address.");
      return;
    }

    if (!/^G[A-Z2-7]{55}$/.test(walletAddress.trim())) {
      setError("Invalid Stellar address. Must start with G and be 56 chars.");
      return;
    }

    setLoading(true);
    try {
      // In production this calls your backend /payments/stellar/initiate
      // which builds and submits the transaction via Horizon.
      await new Promise((res) => setTimeout(res, 1200));
      const mockHash =
        "TX" + Math.random().toString(36).substring(2, 18).toUpperCase();
      setTxHash(mockHash);
      setStep("done");
      onSuccess?.(mockHash);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Payment failed. Please retry."
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === "done" && txHash) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-green-200 bg-green-50 p-8">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold text-green-800">
          Payment Successful
        </h2>
        <p className="text-sm text-green-700">
          {formatAssetAmount(total, asset)} {asset} sent
        </p>
        <p className="break-all rounded bg-green-100 p-2 font-mono text-xs text-green-900">
          {txHash}
        </p>
        <a
          href={`https://stellar.expert/explorer/public/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 underline"
        >
          View on Stellar Explorer
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        Stellar Checkout
      </h2>

      {/* Order summary */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-gray-600">Order Summary</h3>
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex justify-between px-4 py-2 text-sm text-gray-700"
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between px-4 py-2 text-sm font-semibold text-gray-900">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Asset selector */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="asset-select"
          className="text-sm font-medium text-gray-700"
        >
          Pay with
        </label>
        <select
          id="asset-select"
          value={asset}
          onChange={(e) => setAsset(e.target.value as StellarAsset)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="XLM">XLM — Stellar Lumens</option>
          <option value="USDC">USDC — USD Coin (Stellar)</option>
          <option value="BITE">BITE — Loyalty Token</option>
        </select>
        <p className="text-xs text-gray-500">
          Amount due: {formatAssetAmount(total, asset)} {asset}
        </p>
      </div>

      {/* Wallet address */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="wallet-address"
          className="text-sm font-medium text-gray-700"
        >
          Your Stellar Wallet Address
        </label>
        <input
          id="wallet-address"
          type="text"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="GABC...XYZ"
          className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-describedby="wallet-hint"
        />
        <p id="wallet-hint" className="text-xs text-gray-500">
          Must be a valid Stellar public key (starts with G, 56 characters).
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Processing…" : `Pay ${formatAssetAmount(total, asset)} ${asset}`}
        </button>
      </div>
    </div>
  );
}