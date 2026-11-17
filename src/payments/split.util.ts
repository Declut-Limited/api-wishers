// Paystack's local fee: 1.5% + ₦100, the ₦100 waived under ₦2,500, capped at ₦2,000.
const FEE_RATE = 0.015;
const FEE_FLAT = 100;
const FEE_FLAT_THRESHOLD = 2500;
const FEE_CAP = 2000;

export interface GiftSplit {
  // All whole naira.
  giftAmount: number;
  wisherShare: number;
  referrerShare: number;
  appShare: number;
  charges: number;
  totalAmount: number;
}

// What the giver pays so that, after Paystack's fee, the full gift is left to split.
export function totalWithFee(giftAmount: number): number {
  const keep = 1000 - FEE_RATE * 1000;
  let total = Math.ceil((giftAmount * 1000) / keep);
  if (total >= FEE_FLAT_THRESHOLD) {
    total = Math.ceil(((giftAmount + FEE_FLAT) * 1000) / keep);
  }
  return Math.min(total, giftAmount + FEE_CAP);
}

// Paystack refuses a split that sends a subaccount less than ₦100.
export const MIN_SPLIT_SHARE = 100;

// Shares in whole naira; Wishers keeps whatever is left after the wisher and referrer.
// A referrer's cut under ₦100 can't be paid out, so Wishers keeps it and the referrer gets none.
export function splitGift(
  giftAmount: number,
  wisherPercentage: number,
  referrerPercentage: number | null,
): GiftSplit {
  const wisherShare = Math.round((giftAmount * wisherPercentage) / 100);
  const referrerCut =
    referrerPercentage === null
      ? 0
      : Math.round((giftAmount * referrerPercentage) / 100);
  const referrerShare = referrerCut >= MIN_SPLIT_SHARE ? referrerCut : 0;
  const totalAmount = totalWithFee(giftAmount);
  return {
    giftAmount,
    wisherShare,
    referrerShare,
    appShare: giftAmount - wisherShare - referrerShare,
    charges: totalAmount - giftAmount,
    totalAmount,
  };
}
