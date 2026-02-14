import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create the default user: tyler@dynamiccode.com.au / Dynamic
  const hashedPassword = await bcrypt.hash('Dynamic', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'tyler@dynamiccode.com.au' },
    update: {},
    create: {
      email: 'tyler@dynamiccode.com.au',
      name: 'Tyler',
      password: hashedPassword,
    },
  });

  console.log('✅ Seed user created:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
