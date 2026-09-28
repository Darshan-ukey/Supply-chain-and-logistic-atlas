import { createFileRoute } from "@tanstack/react-router";
import { bolIntelligencePackage } from "@/data/bol-intelligence";
export const Route = createFileRoute("/api/bol/intelligence-package")({ server: { handlers: { GET: async () => Response.json(bolIntelligencePackage) } } });