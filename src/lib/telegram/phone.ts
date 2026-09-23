export function normalizeTelegramPhone(value: string): string {
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  let normalized = value
    .split("")
    .map((char) => {
      const p = persianDigits.indexOf(char);
      if (p >= 0) return String(p);
      const a = arabicDigits.indexOf(char);
      return a >= 0 ? String(a) : char;
    })
    .join("");

  const digits = normalized.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("0098")) return "+98" + digits.slice(4);
  if (digits.startsWith("98")) return "+98" + digits.slice(2);
  if (digits.startsWith("0")) return "+98" + digits.slice(1);
  return "+" + digits;
}
