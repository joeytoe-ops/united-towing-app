/* Business expense categories used across Finances tab. */
export const CATEGORIES = [
  "Rent",
  "Fuel",
  "Repairs & Maintenance",
  "Insurance",
  "Phones",
  "Accounting & Legal",
  "Taxes",
  "Tolls",
  "Supplies",
  "Payroll",
  "Bank Fees",
  "Uncategorized",
];

/* Map Plaid category hierarchy → our buckets. Match most specific first. */
const PLAID_MAP = [
  [["Rent"], "Rent"],
  [["Real Estate"], "Rent"],
  [["Auto", "Gas Stations"], "Fuel"],
  [["Auto", "Auto Services"], "Repairs & Maintenance"],
  [["Auto", "Service", "Auto Repair"], "Repairs & Maintenance"],
  [["Auto"], "Fuel"],
  [["Transportation", "Gas Stations"], "Fuel"],
  [["Travel", "Gas Stations"], "Fuel"],
  [["Insurance"], "Insurance"],
  [["Telecommunications", "Telecommunication Services"], "Phones"],
  [["Telecommunications"], "Phones"],
  [["Professional Services", "Legal"], "Accounting & Legal"],
  [["Professional Services", "Accounting and Bookkeeping"], "Accounting & Legal"],
  [["Professional Services"], "Accounting & Legal"],
  [["Taxes"], "Taxes"],
  [["Travel", "Tolls and Fees"], "Tolls"],
  [["Travel", "Taxi"], "Tolls"],
  [["Transportation", "Tolls and Fees"], "Tolls"],
  [["General Merchandise"], "Supplies"],
  [["Shops", "Hardware Store"], "Supplies"],
  [["Service", "Financial", "Banking and Finance"], "Bank Fees"],
  [["Bank Fees"], "Bank Fees"],
  [["Transfer"], "Uncategorized"],
  [["Payroll"], "Payroll"],
];

/* Per-merchant overrides: substring (case-insensitive) → our category. */
const MERCHANT_PATTERNS = [
  [/progressive/i, "Insurance"],
  [/geico/i, "Insurance"],
  [/state farm/i, "Insurance"],
  [/verizon/i, "Phones"],
  [/t-mobile|tmobile/i, "Phones"],
  [/at&t|att\s|attwireless/i, "Phones"],
  [/shell|mobil|exxon|chevron|bp\s|sunoco|7-eleven|wawa/i, "Fuel"],
  [/ez[- ]?pass|ezpass|mta|port authority|triborough/i, "Tolls"],
  [/autozone|napa|advance auto|pep boys|o'?reilly/i, "Repairs & Maintenance"],
  [/home depot|lowes|lowe's|harbor freight/i, "Supplies"],
  [/irs|department of revenue|nys tax/i, "Taxes"],
  [/adp|gusto|paychex/i, "Payroll"],
];

function prefixMatches(plaidCats, pattern) {
  if (!plaidCats || plaidCats.length < pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (String(plaidCats[i]).toLowerCase() !== String(pattern[i]).toLowerCase()) return false;
  }
  return true;
}

/* Resolve final category for a transaction.
   Priority: user override → merchant pattern → Plaid category map → "Uncategorized". */
export function categorize(txn) {
  if (txn?.override_category) return txn.override_category;
  const merchant = txn?.merchant_name || txn?.name || "";
  for (const [pattern, cat] of MERCHANT_PATTERNS) {
    if (pattern.test(merchant)) return cat;
  }
  const plaidCats = txn?.category || [];
  for (const [pattern, cat] of PLAID_MAP) {
    if (prefixMatches(plaidCats, pattern)) return cat;
  }
  return "Uncategorized";
}
