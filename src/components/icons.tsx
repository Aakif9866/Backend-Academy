import {
  Cpu, Globe, Server, Database, ShieldCheck, Zap, Boxes, Network, Gauge, Container, Activity, Sparkles,
  type LucideIcon,
} from "lucide-react";

export const levelIcons: Record<string, LucideIcon> = {
  foundations: Cpu, networking: Globe, "backend-dev": Server, databases: Database, security: ShieldCheck,
  async: Zap, architecture: Boxes, "system-design": Network, performance: Gauge, devops: Container,
  observability: Activity, advanced: Sparkles,
};
