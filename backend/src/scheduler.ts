import cron from 'node-cron';
import { warmTopCities, checkInsightsEmpty } from './scripts/warmCache';

/**
 * Start the cache warmer:
 * - On startup: if AI insights cache is empty, warm immediately (fire-and-forget).
 * - Scheduled: every Sunday at midnight UTC to refresh 7-day caches.
 */
export async function startCacheWarmer(): Promise<void> {
  console.log('📅 Cache warming scheduler started');

  // Startup check — warm immediately if no insights are cached
  const isEmpty = await checkInsightsEmpty();
  if (isEmpty) {
    console.log('📭 No AI insights found in cache — warming immediately (background)...');
    warmTopCities().catch((err) => console.error('❌ Initial cache warm failed:', err));
  } else {
    console.log('✅ Cache populated — skipping immediate warm, next run Sunday midnight UTC');
  }

  // Weekly refresh — every Sunday at 00:00 UTC
  cron.schedule('0 0 * * 0', async () => {
    console.log('\n⏰ Weekly cache warming triggered');
    try {
      await warmTopCities();
      console.log('✅ Weekly cache warming completed\n');
    } catch (error) {
      console.error('❌ Weekly cache warming failed:', error);
    }
  });

  console.log('   Schedule: Every Sunday at 00:00 UTC');
  console.log('   Method: Nominatim geocoding + Overpass POI fetch + AI city insights');
  console.log('   Cache TTL: 24h (Nominatim), 2h (POI data), 7d (AI insights)\n');
}
