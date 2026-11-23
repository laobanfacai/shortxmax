export function SocialProof({
  unlockedHour,
  upgradesToday,
}: {
  unlockedHour: number;
  upgradesToday?: number;
}) {
  const hour = Math.max(unlockedHour, 0);
  return (
    <p className="text-sm text-muted">
      {hour > 0 ? (
        <>
          <span className="font-sans tabular-nums text-gold-soft">{hour} episode{hour === 1 ? "" : "s"}</span> unlocked in the last hour
        </>
      ) : (
        <>Viewers are finishing series tonight — unlock the rest with VIP.</>
      )}
      {upgradesToday && upgradesToday > 0 ? (
        <>
          {" "}
          · <span className="font-sans tabular-nums text-gold-soft">{upgradesToday} VIP upgrade{upgradesToday === 1 ? "" : "s"}</span> today
        </>
      ) : null}
    </p>
  );
}
