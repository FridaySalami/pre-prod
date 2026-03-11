import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testSageReportModel() {
  try {
    console.log('Testing SageReport model...')

    // Test if we can access the sageReport model
    const count = await prisma.sageReport.count()
    console.log('SageReport count:', count)

    console.log('✅ SageReport model is working!')
  } catch (error) {
    console.error('❌ Error accessing SageReport model:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSageReportModel()
