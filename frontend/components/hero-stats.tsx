import { Shield, ShieldCheck, Lock } from "lucide-react";

const badges = [
  {
    icon: Shield,
    label: "Non-Custodial",
    detail: "You hold your keys",
  },
  {
    icon: ShieldCheck,
    label: "Compliance Built In",
    detail: "Approved senders only",
  },
  {
    icon: Lock,
    label: "150% Collateralized",
    detail: "Your BTC is always safe",
  },
];

export function HeroStats() {
  return (
    <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
      {badges.map((b) => (
        <div key={b.label} className="glass rounded-xl p-4 text-center">
          <b.icon className="w-5 h-5 text-gold mx-auto mb-2" />
          <p className="text-xs font-semibold text-void-100">{b.label}</p>
          <p className="text-[10px] text-void-500 mt-0.5">{b.detail}</p>
        </div>
      ))}
    </div>
  );
}
