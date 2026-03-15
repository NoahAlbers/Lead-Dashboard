export function getStateColor(classification: string): { bg: string; text: string } {
  if (classification === "good") return { bg: "bg-green-100", text: "text-green-700" };
  if (classification === "banned") return { bg: "bg-red-100", text: "text-red-700" };
  return { bg: "bg-primary/10", text: "text-primary" };
}

export function getStateColorHex(classification: string): string {
  if (classification === "good") return "#16a34a";
  if (classification === "banned") return "#dc2626";
  return "#3D5AF1";
}

export function getStateFillColor(classification: string, count: number, maxCount: number): string {
  if (classification === "good") {
    if (count === 0) return "#dcfce7";
    const intensity = Math.min(count / maxCount, 1);
    const r = Math.round(220 + (22 - 220) * intensity);
    const g = Math.round(252 + (163 - 252) * intensity);
    const b = Math.round(231 + (74 - 231) * intensity);
    return `rgb(${r},${g},${b})`;
  }
  if (classification === "banned") {
    if (count === 0) return "#fecaca";
    const intensity = Math.min(count / maxCount, 1);
    const r = Math.round(254 + (220 - 254) * intensity);
    const g = Math.round(202 + (38 - 202) * intensity);
    const b = Math.round(202 + (38 - 202) * intensity);
    return `rgb(${r},${g},${b})`;
  }
  // Unknown / default — blue gradient
  if (count === 0) return "#EEF1FE";
  const intensity = Math.min(count / maxCount, 1);
  const r = Math.round(238 + (61 - 238) * intensity);
  const g = Math.round(241 + (90 - 241) * intensity);
  const b = Math.round(254 + (241 - 254) * intensity);
  return `rgb(${r},${g},${b})`;
}
