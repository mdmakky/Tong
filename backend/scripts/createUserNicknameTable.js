import { prisma } from '../src/config/database.js';

async function addSelfNicknameColumn() {
    try {
        console.log('Adding self_nickname column to contacts table...');

        // Add self_nickname column to contacts table if it doesn't exist
        await prisma.$executeRaw`
      ALTER TABLE "contacts" 
      ADD COLUMN IF NOT EXISTS "self_nickname" VARCHAR(100)
    `;

        console.log('✓ self_nickname column added successfully!');
    } catch (error) {
        console.error('✗ Error adding column:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

addSelfNicknameColumn();

