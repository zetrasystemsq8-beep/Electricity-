import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

/** Section 9: the Token Vault - every token ever vended through the app. */
export async function listTokenVault(userId: string, meterId?: string) {
  return prisma.token.findMany({
    where: {
      purchase: { userId },
      ...(meterId ? { meterId } : {}),
    },
    include: { meter: { include: { disco: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getToken(userId: string, tokenId: string) {
  const token = await prisma.token.findFirst({
    where: { id: tokenId, purchase: { userId } },
    include: { meter: { include: { disco: true } }, purchase: { include: { transaction: true } } },
  });
  if (!token) throw ApiError.notFound("Token not found.");
  return token;
}

export async function markTokenLoaded(userId: string, tokenId: string, loaded: boolean) {
  const token = await prisma.token.findFirst({ where: { id: tokenId, purchase: { userId } } });
  if (!token) throw ApiError.notFound("Token not found.");
  return prisma.token.update({
    where: { id: tokenId },
    data: { loadingStatus: loaded ? "LOADED" : "NOT_LOADED" },
  });
}
