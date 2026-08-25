const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.voice.findUnique({ where: { id: '9b768184-24c4-4083-8b17-38a7498e996e' }, include: { file: true } }).then(console.log).finally(() => prisma.$disconnect());
