// Sections 13, 29: support center + "I don't understand my meter" flows.
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { SupportCategory } from "@prisma/client";

export async function createSupportTicket(
  userId: string,
  params: { category: SupportCategory; description: string }
) {
  return prisma.supportTicket.create({
    data: { userId, category: params.category, description: params.description },
  });
}

export async function listMySupportTickets(userId: string) {
  return prisma.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getSupportTicket(userId: string, ticketId: string) {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, userId } });
  if (!ticket) throw ApiError.notFound("Support ticket not found.");
  return ticket;
}

/**
 * Section 13: canned, verified self-help steps for the common problems.
 * These are deliberately generic (not meter-model specific) - meter-model
 * specific steps live in MeterModel.balanceCheckSteps / tokenLoadSteps and
 * are surfaced via meterGuideService instead.
 */
const SELF_HELP: Record<string, { title: string; steps: string[] }> = {
  CHECK_BALANCE: {
    title: "How to check your balance",
    steps: [
      "Go to your meter's keypad (the CIU).",
      "Enter your DISCO's balance-check code (see your meter's guide in the app for the exact code).",
      "Press Enter.",
      "Your remaining units will appear on the small screen.",
    ],
  },
  LOAD_TOKEN: {
    title: "How to load your token",
    steps: [
      "Open My Tokens in the app and copy the 20-digit token.",
      "On your meter's keypad, enter the token exactly as shown, including all digits.",
      "Press Enter.",
      "Wait for the confirmation message or beep.",
      "Check your new balance to confirm it loaded.",
    ],
  },
  TOKEN_NOT_WORKING: {
    title: "My token isn't working",
    steps: [
      "Re-enter the token carefully - a single wrong digit will reject it.",
      "Confirm the token was generated for this exact meter number.",
      "Some meters reject a token entered too many times incorrectly and need a short wait before retrying.",
      "If it still fails, raise a Token Problem ticket from Support and include the transaction reference.",
    ],
  },
  METER_ERROR: {
    title: "My meter shows an error",
    steps: [
      "Note the exact error code or message shown on the meter display.",
      "Check that you are not mid-way through entering a token or code.",
      "Consult your meter's guide in the app for that specific error code, if listed.",
      "If unresolved, raise a Meter Problem ticket and include the error shown.",
    ],
  },
  ELECTRICITY_FINISHED: {
    title: "My electricity finished",
    steps: [
      "Confirm the balance is actually zero on the meter display, not just low in the app's estimate.",
      "Buy electricity from the Buy tab.",
      "Load the new token as soon as it's generated.",
    ],
  },
  NO_TOKEN_RECEIVED: {
    title: "I bought electricity but didn't receive a token",
    steps: [
      "Open History and check the transaction status.",
      "If it shows Pending, wait a few minutes - the provider may still be confirming.",
      "If it shows Successful but no token appears, raise a Token Problem ticket with the transaction reference - do not repurchase.",
      "If it shows Failed and you were charged, raise a Payment Problem ticket for a refund.",
    ],
  },
  DEDUCTION_UNCLEAR: {
    title: "I don't understand my deduction",
    steps: [
      "Open the transaction in History to see the exact breakdown returned by the provider.",
      "Any amount the app can't attribute to electricity value is shown as the provider's reported charge, never guessed.",
      "If something still looks wrong, raise a ticket under Balance Problem with the transaction reference.",
    ],
  },
  METER_NOT_CONNECTING: {
    title: "My meter isn't connecting",
    steps: [
      "This app does not directly connect to your physical meter unless a live-data integration is available for your DISCO.",
      "Check whether your meter shows 'Live meter balance' or 'Estimated' on the Home screen - only Live means a direct connection exists.",
      "For estimated meters, enter your current reading manually to refresh your estimate.",
    ],
  },
};

export function getSelfHelp(topic: string) {
  const entry = SELF_HELP[topic];
  if (!entry) throw ApiError.notFound("No self-help guide found for that topic.");
  return entry;
}

export function listSelfHelpTopics() {
  return Object.entries(SELF_HELP).map(([key, v]) => ({ key, title: v.title }));
}
