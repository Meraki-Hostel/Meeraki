import { PrismaClient } from "@prisma/client";
import { isProd } from "./env.js";
const g = globalThis;
export const prisma = g.prisma || new PrismaClient({ log: isProd ? ["error"] : ["warn", "error"] });
if (!isProd) g.prisma = prisma;
