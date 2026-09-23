// Seeds the 11 licensed Nigerian electricity distribution companies.
// shortCode values are the conventional VTpass serviceID slugs -
// double check against VTpass's live /service-categories response before
// going to production, since providers occasionally rename these.
import { prisma } from "../lib/prisma";

const DISCOS: Array<{ name: string; shortCode: string; region: string }> = [
  { name: "Abuja Electricity Distribution Company", shortCode: "abuja-electric", region: "Abuja" },
  { name: "Benin Electricity Distribution Company", shortCode: "benin-electric", region: "Edo/Delta" },
  { name: "Eko Electricity Distribution Company", shortCode: "eko-electric", region: "Lagos (Eko)" },
  { name: "Enugu Electricity Distribution Company", shortCode: "enugu-electric", region: "South East" },
  { name: "Ibadan Electricity Distribution Company", shortCode: "ibadan-electric", region: "South West" },
  { name: "Ikeja Electric", shortCode: "ikeja-electric", region: "Lagos (Ikeja)" },
  { name: "Jos Electricity Distribution Company", shortCode: "jos-electric", region: "North Central" },
  { name: "Kaduna Electric", shortCode: "kaduna-electric", region: "North West" },
  { name: "Kano Electricity Distribution Company", shortCode: "kano-electric", region: "North West" },
  { name: "Port Harcourt Electricity Distribution Company", shortCode: "portharcourt-electric", region: "South South" },
  { name: "Yola Electricity Distribution Company", shortCode: "yola-electric", region: "North East" },
];

async function main() {
  for (const disco of DISCOS) {
    await prisma.disco.upsert({
      where: { shortCode: disco.shortCode },
      update: { name: disco.name, region: disco.region, isActive: true },
      create: disco,
    });
  }
  console.log(`Seeded ${DISCOS.length} DISCOs.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
