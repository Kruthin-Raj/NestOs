import cron from 'node-cron'
import { prisma } from '@config/prisma'
import { createNoticeService } from '../modules/notices/notices.service'
import { logger } from '@utils/logger'

// Run daily at midnight to check for breached SLAs
export function initIssueSlaCron() {
  cron.schedule('0 0 * * *', async () => {
    logger.info('[Cron] Running daily Issue SLA check...')
    
    try {
      const now = new Date()
      
      const breachedIssues = await prisma.issue.findMany({
        where: {
          status: 'IN_PROGRESS',
          slaDeadline: {
            lt: now
          },
          deletedAt: null
        },
        include: {
          owner: {
            include: {
              user: true
            }
          }
        }
      })
      
      if (breachedIssues.length > 0) {
        logger.info(`[Cron] Found ${breachedIssues.length} issues that have breached SLA.`)
        
        for (const issue of breachedIssues) {
          await createNoticeService(issue.ownerId, {
            title: 'SLA Breached: Issue Overdue',
            body: `The issue "${issue.title}" has been in progress for over 14 days. Please resolve it immediately to comply with SLA guidelines.`,
            category: 'MAINTENANCE',
            targetType: 'ALL_BUILDINGS',
            sendEmail: true 
          })
        }
      }
    } catch (error) {
      logger.error('[Cron] Failed to run Issue SLA check', error)
    }
  })
}
