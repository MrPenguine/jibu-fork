import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill script for default folders...');

  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  console.log(`Found ${organizations.length} organizations to process.`);

  for (const org of organizations) {
    // Check if a default folder already exists to prevent duplicates
    const existingDefaultFolder = await prisma.folder.findFirst({
      where: {
        name: 'Default Projects',
        organizationId: org.id,
      },
    });

    let folderId: string;

    if (existingDefaultFolder) {
      console.log(`Default folder already exists for organization: ${org.name} (${org.id})`);
      folderId = existingDefaultFolder.id;
    } else {
      const newFolder = await prisma.folder.create({
        data: {
          name: 'Default Projects',
          organizationId: org.id,
        },
      });
      console.log(`Created new default folder for organization: ${org.name} (${org.id})`);
      folderId = newFolder.id;
    }

    const result = await prisma.agent.updateMany({
      where: {
        organizationId: org.id,
        folderId: null, // Only update agents that are not in any folder
      },
      data: {
        folderId: folderId,
      },
    });

    if (result.count > 0) {
      console.log(`  -> Assigned ${result.count} agent(s) to the default folder.`);
    } else {
      console.log(`  -> No agents needed updating for this organization.`);
    }
  }

  console.log('Backfill script completed successfully.');
}

main()
  .catch((e) => {
    console.error('An error occurred during the backfill process:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
