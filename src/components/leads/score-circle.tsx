interface ScoreCircleProps {
  score: number | null;
  tierColor?: string; // hex from tierColorMap
}

function getContrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1A1A2E" : "#ffffff";
}

export function ScoreCircle({ score, tierColor }: ScoreCircleProps) {
  if (score === null) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-muted">
        <span className="text-sm text-muted-foreground">—</span>
      </div>
    );
  }

  const borderColor = tierColor ?? "#8889A0";
  const textColor = tierColor ? getContrastTextColor(tierColor) : undefined;

  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full"
      style={{
        border: `3px solid ${borderColor}`,
        backgroundColor: tierColor ? `${tierColor}18` : undefined,
      }}
    >
      <span
        className="text-lg font-bold leading-none"
        style={textColor ? { color: getContrastTextColor("#ffffff") } : undefined}
      >
        {score}
      </span>
    </div>
  );
}
