import 'dotenv/config';
import { BenchmarkDatabase } from './db.js';
import { DeterministicScheduler } from './scheduler.js';

async function main() {
  console.log('[Comparativo LLMs] Iniciando sincronização determinística única de verificação...');
  const db = new BenchmarkDatabase();
  const scheduler = new DeterministicScheduler(db, 300000);
  const runLog = await scheduler.executeSync('manual');

  console.log('\n=== RESUMO DA EXECUÇÃO DETERMINÍSTICA ===');
  console.log(runLog.summaryMessage);
  console.log({
    totalSources: runLog.totalSources,
    liveSources: runLog.liveSources,
    partialSources: runLog.partialSources,
    manualSources: runLog.manualSources,
    unavailableSources: runLog.unavailableSources,
    totalScoresUpserted: runLog.totalScoresUpserted,
    modelsDiscovered: runLog.modelsDiscovered,
    providersDiscovered: runLog.providersDiscovered,
  });

  console.log('\n=== STATUS DETALHADO POR FONTE ===');
  for (const st of db.getSourceStatuses()) {
    console.log(
      `- [${st.status.toUpperCase()}] ${st.sourceId} (${st.recordsCount} regs, ${st.durationMs}ms): ${st.technicalReason}`
    );
  }

  db.close();
}

main().catch((err) => {
  console.error('Erro na sincronização:', err);
  process.exit(1);
});