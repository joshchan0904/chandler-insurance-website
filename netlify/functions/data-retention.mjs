// Daily data-retention job (scheduled; runs only on the published production deploy, never on draft deploys).
// Deletes uploaded dec pages 90 days after upload and website quote-lead records 3 years after their last update.
// See lib/retention.mjs. Set env RETENTION_DRY_RUN=1 to log what would be deleted without deleting anything.
// Does NOT delete Netlify Forms submissions or forms, or anything in the office mailbox.
import { files, leads } from '../lib/leads.mjs';
import { purgeDecFiles, purgeLeads } from '../lib/retention.mjs';

export default async () => {
  const dryRun = process.env.RETENTION_DRY_RUN === '1';
  const f = await purgeDecFiles(files(), { dryRun });
  const l = await purgeLeads(leads(), { dryRun });
  console.log(`data-retention${dryRun ? ' (DRY RUN, nothing deleted)' : ''}: dec files ${JSON.stringify(f)}; leads ${JSON.stringify(l)}`); // counts only
};
export const config = { schedule: '17 9 * * *' }; // daily 09:17 UTC (3:17 or 4:17 AM CT)
