import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const patients = [
    { firstName: 'Anna', lastName: 'Gonzalez', dob: new Date('1950-03-12'), mrn: 'P0001' },
    { firstName: 'Robert', lastName: 'Smith',   dob: new Date('1946-11-03'), mrn: 'P0002' },
    { firstName: 'Luz', lastName: 'Martinez',   dob: new Date('1958-07-21'), mrn: 'P0003' }
  ];
  for (const p of patients) await db.patient.upsert({ where: { mrn: p.mrn }, update: {}, create: p });
  console.log('Seeded patients');
}
main().finally(() => db.$disconnect());
