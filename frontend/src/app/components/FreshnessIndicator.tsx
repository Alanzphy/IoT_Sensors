interface FreshnessIndicatorProps {
  lastUpdate: Date;
  variant?: "light" | "dark";
}

export function FreshnessIndicator({ lastUpdate, variant = "light" }: FreshnessIndicatorProps) {
  let minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60));
  if (minutesAgo < 0) minutesAgo = 0;
  
  let status: "recent" | "warning" | "error";
  let dotColor: string;
  
  if (minutesAgo < 30) {
    status = "recent";
    dotColor = "#6D7E5E"; // green
  } else if (minutesAgo < 120) {
    status = "warning";
    dotColor = "#D97706"; // orange
  } else {
    status = "error";
    dotColor = "#DC2626"; // red
  }

  const getTimeText = () => {
    if (minutesAgo < 60) {
      return `hace ${minutesAgo} min`;
    } else {
      const hours = Math.floor(minutesAgo / 60);
      const mins = minutesAgo % 60;
      return `hace ${hours}h ${mins}min`;
    }
  };

  const textColor = variant === "dark" ? "text-[#F4F1EB]/70" : "text-[#6E6359]";

  return (
    <div className={`flex items-center gap-2 text-sm ${textColor}`}>
      <div 
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <span>Último dato: {getTimeText()}</span>
    </div>
  );
}
