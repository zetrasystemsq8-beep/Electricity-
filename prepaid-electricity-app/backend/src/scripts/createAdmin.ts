// Usage: npx tsx src/scripts/createAdmin.ts +2348012345678 "Admin Name" "strongpassword"
import { prisma } from "../lib/prisma";
import { hashPassword } from "../utils/password";

async function main() {
  const [phoneNumber, fullName, password] = process.argv.slice(2);
  if (!phoneNumber || !fullName || !password) {
    console.error('Usage: npx tsx src/scripts/createAdmin.ts "<phone>" "<full name>" "<password>"');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { phoneNumber },
    update: { role: "ADMIN", fullName, passwordHash },
    create: { phoneNumber, fullName, passwordHash, role: "ADMIN" },
  });

  console.log(`Admin user ready: ${user.phoneNumber} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
