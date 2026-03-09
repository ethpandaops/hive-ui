import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TestRun } from '../types';
import { fetchTestDetail } from '../services/api';
import { useTheme } from '../contexts/useTheme';
import { calculateMedian, isBenchmarkIgnoredTest } from '../constants/benchmark';
import { formatMs } from '../utils/formatMs';

interface ClientBenchmarkCardProps {
  groupKey: string;
  groupRuns: TestRun[];
  directory: string;
  directoryAddress: string;
}

interface ClientStats {
  run: TestRun;
  medianMs: number;
  meanMs: number;
  p95Ms: number;
  testCount: number;
  passRate: number;
  hasBenchmarkData: boolean;
  score: number; // medianMs × (ntests / passes)² — penalises failures
}

type RankBy = 'score' | 'speed' | 'compliance';

const MEDALS = ['🥇', '🥈', '🥉'];

const SORT_OPTIONS: { value: RankBy; label: string }[] = [
  { value: 'score', label: 'Weighted score' },
  { value: 'speed', label: 'Speed' },
  { value: 'compliance', label: 'Compliance' },
];

const ClientBenchmarkCard = ({ groupKey, groupRuns, directory, directoryAddress }: ClientBenchmarkCardProps) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [rankBy, setRankBy] = useState<RankBy>('score');

  const { data: benchmarkData, isLoading } = useQuery({
    queryKey: ['benchmark', directoryAddress, groupKey, groupRuns.map(r => r.fileName).join(',')],
    queryFn: async (): Promise<{ stats: ClientStats[]; failedCount: number }> => {
      const results = await Promise.allSettled(
        groupRuns.map(async (run) => ({
          run,
          detail: await fetchTestDetail(directoryAddress, run.fileName),
        }))
      );

      const stats = results
        .filter(
          (result): result is PromiseFulfilledResult<{ run: TestRun; detail: Awaited<ReturnType<typeof fetchTestDetail>> }> =>
            result.status === 'fulfilled'
        )
        .map(({ value: { run, detail } }) => {
          const passingCases = Object.values(detail.testCases).filter(
            c => !isBenchmarkIgnoredTest(c.name) && c.summaryResult.pass
          );

          const durations = passingCases
            .map(c => {
              const d = new Date(c.end).getTime() - new Date(c.start).getTime();
              return d >= 0 ? d : 0;
            })
            .sort((a, b) => a - b);

          const hasBenchmarkData = durations.length > 0;
          const totalMs = durations.reduce((sum, d) => sum + d, 0);
          const medianMs = hasBenchmarkData ? calculateMedian(durations) : 0;
          const meanMs = hasBenchmarkData ? totalMs / durations.length : 0;
          const p95Ms = hasBenchmarkData ? durations[Math.floor(durations.length * 0.95)] : 0;
          const passRate = run.ntests > 0 ? run.passes / run.ntests : 0;
          const passRatio = run.passes > 0 ? run.ntests / run.passes : Infinity;
          const score = hasBenchmarkData && run.passes > 0 ? medianMs * (passRatio * passRatio) : Infinity;

          return { run, medianMs, meanMs, p95Ms, testCount: passingCases.length, passRate, hasBenchmarkData, score };
        });

      return {
        stats,
        failedCount: results.length - stats.length,
      };
    },
    enabled: isExpanded && !!directoryAddress,
    staleTime: 5 * 60 * 1000,
  });

  const clientStats = benchmarkData?.stats ?? [];
  const failedCount = benchmarkData?.failedCount ?? 0;

  const ranked = clientStats
    ? [...clientStats].sort((a, b) => {
        if (rankBy === 'score') {
          if (!a.hasBenchmarkData && !b.hasBenchmarkData) return b.passRate - a.passRate;
          if (!a.hasBenchmarkData) return 1;
          if (!b.hasBenchmarkData) return -1;
          return a.score - b.score;
        }

        if (rankBy === 'speed') {
          if (!a.hasBenchmarkData && !b.hasBenchmarkData) return b.passRate - a.passRate;
          if (!a.hasBenchmarkData) return 1;
          if (!b.hasBenchmarkData) return -1;
          return a.medianMs - b.medianMs;
        }

        return b.passRate - a.passRate; // compliance: higher pass rate first
      })
    : [];

  // Score rank is always fixed to weighted score order for medal display
  const scoreRanked = clientStats
    ? [...clientStats].sort((a, b) => {
        if (!a.hasBenchmarkData && !b.hasBenchmarkData) return b.passRate - a.passRate;
        if (!a.hasBenchmarkData) return 1;
        if (!b.hasBenchmarkData) return -1;
        return a.score - b.score;
      })
    : [];
  const bestScore = scoreRanked.find((stats) => Number.isFinite(stats.score))?.score ?? null;
  const formatNormalizedScore = (score: number): string => {
    if (bestScore === null) return 'n/a';
    if (bestScore > 0) return `${(score / bestScore).toFixed(2)}×`;
    return score === 0 ? '1.00×' : 'n/a';
  };

  const border = isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)';
  const muted = isDarkMode ? '#94a3b8' : '#64748b';

  // Grid: rank | client | score | pass% | median | mean | p95
  const gridCols = '1.5rem 1fr 65px 55px 70px 70px 70px';

  const colActive = (col: 'score' | 'pass' | 'median') => {
    if (col === 'score') return rankBy === 'score';
    if (col === 'pass') return rankBy === 'compliance';
    if (col === 'median') return rankBy === 'speed';
    return false;
  };

  return (
    <div style={{
      gridColumn: '1 / -1',
      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
      borderRadius: '0.375rem',
      border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(v => !v)}
        style={{
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
          borderBottom: isExpanded ? `1px solid ${border}` : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            color: muted,
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#6366f1' }}>
            Client Benchmark
          </span>
          <span style={{ fontSize: '0.7rem', color: muted }}>
            {groupRuns.length} clients
          </span>
        </div>
        {bestScore !== null && scoreRanked.length > 0 && (
          <span style={{ fontSize: '0.7rem', color: muted }}>
            {MEDALS[0]} {scoreRanked[0].run.clients.join('+')}
          </span>
        )}
      </div>

      {/* Body */}
      {isExpanded && (
        <div style={{ padding: '0.75rem' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '0.5rem', color: muted }}>
              <div style={{
                border: `2px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                width: '1rem',
                height: '1rem',
                animation: 'spin 1s linear infinite',
              }} />
              <span style={{ fontSize: '0.8rem' }}>Loading test details for {groupRuns.length} clients...</span>
            </div>
          ) : ranked.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {failedCount > 0 && (
                <div style={{ fontSize: '0.7rem', color: muted }}>
                  Skipped {failedCount} run{failedCount === 1 ? '' : 's'} because benchmark details could not be loaded.
                </div>
              )}

              {/* Sort toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', color: muted }}>Rank by</span>
                <div style={{
                  display: 'flex',
                  gap: '0.25rem',
                  backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9',
                  borderRadius: '0.375rem',
                  padding: '0.125rem',
                  border: `1px solid ${border}`,
                }}>
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setRankBy(opt.value)}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: rankBy === opt.value ? '600' : '400',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.25rem',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: rankBy === opt.value ? '#6366f1' : 'transparent',
                        color: rankBy === opt.value ? '#ffffff' : muted,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gap: '0.5rem',
                padding: '0 0.5rem 0.375rem',
                fontSize: '0.65rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: muted,
                borderBottom: `1px solid ${border}`,
                marginBottom: '0.25rem',
              }}>
                <div />
                <div>Client</div>
                <div style={{ textAlign: 'right', color: colActive('score') ? '#6366f1' : undefined }}>Score</div>
                <div style={{ textAlign: 'right', color: colActive('pass') ? '#6366f1' : undefined }}>Pass%</div>
                <div style={{ textAlign: 'right', color: colActive('median') ? '#6366f1' : undefined }}>Median</div>
                <div style={{ textAlign: 'right' }}>Mean</div>
                <div style={{ textAlign: 'right' }}>p95</div>
              </div>

              {ranked.map((stats, i) => {
                const suiteid = stats.run.fileName.replace(/\.json$/, '');
                const scoreRank = scoreRanked.findIndex(s => s.run.fileName === stats.run.fileName);

                return (
                  <div key={stats.run.fileName} style={{
                    borderRadius: '0.375rem',
                    padding: '0.5rem',
                    backgroundColor: i === 0
                      ? (isDarkMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)')
                      : 'transparent',
                    border: `1px solid ${i === 0
                      ? (isDarkMode ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)')
                      : 'transparent'}`,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0.5rem', alignItems: 'center' }}>
                      {/* Rank — medal tied to weighted score rank always */}
                      <div style={{ fontSize: scoreRank < 3 ? '1rem' : '0.75rem', lineHeight: 1, color: muted }}>
                        {stats.hasBenchmarkData ? (MEDALS[scoreRank] ?? `${scoreRank + 1}`) : '—'}
                      </div>

                      {/* Client info */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                          {stats.run.clients.map(client => {
                            const clientName = client.split('_')[0].toLowerCase();
                            return (
                              <div key={client} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <img
                                  src={`/img/clients/${clientName}.jpg`}
                                  alt={client}
                                  style={{ width: '14px', height: '14px', borderRadius: '2px', objectFit: 'cover' }}
                                  onError={e => { e.currentTarget.src = '/img/clients/default.jpg'; }}
                                />
                                <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>{client}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: muted, marginTop: '0.1rem' }}>
                          {stats.testCount} tests &middot; {stats.run.passes}/{stats.run.ntests} passed
                        </div>
                      </div>

                      {/* Score */}
                      <div style={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        fontWeight: colActive('score') ? '700' : '400',
                        color: colActive('score') && i === 0 ? '#6366f1' : muted,
                      }}>
                        {stats.hasBenchmarkData && bestScore !== null
                          ? formatNormalizedScore(stats.score)
                          : 'n/a'}
                      </div>

                      {/* Pass% */}
                      <div style={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        fontWeight: colActive('pass') ? '700' : '400',
                        color: colActive('pass') && i === 0 ? '#6366f1' : muted,
                      }}>
                        {(stats.passRate * 100).toFixed(1)}%
                      </div>

                      {/* Median */}
                      <div style={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        fontWeight: colActive('median') ? '700' : '400',
                        color: colActive('median') && i === 0 ? '#6366f1' : muted,
                      }}>
                        {stats.hasBenchmarkData ? formatMs(stats.medianMs) : 'n/a'}
                      </div>

                      {/* Mean */}
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem', color: muted }}>
                        {stats.hasBenchmarkData ? formatMs(stats.meanMs) : 'n/a'}
                      </div>

                      {/* p95 */}
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem', color: muted }}>
                        {stats.hasBenchmarkData ? formatMs(stats.p95Ms) : 'n/a'}
                      </div>
                    </div>

                    {/* Pass/fail bar */}
                    <div style={{
                      marginTop: '0.4rem',
                      marginLeft: '2rem',
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${stats.passRate * 100}%`,
                        borderRadius: '2px',
                        backgroundColor: '#10b981',
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                      <Link
                        to={`/test/${directory}/${suiteid}`}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: '0.65rem', color: '#6366f1', textDecoration: 'none' }}
                      >
                        View run →
                      </Link>
                    </div>
                  </div>
                );
              })}

              <div style={{ fontSize: '0.65rem', color: muted, textAlign: 'right', marginTop: '0.25rem' }}>
                Score = median &times; (total / passed)&sup2;, normalised to best performer (1.00&times;) &middot; penalises failures &middot; timing excludes failed and ignored tests
              </div>
            </div>
          ) : (
            <div style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: muted }}>
              {failedCount > 0
                ? 'Benchmark data could not be loaded for these runs.'
                : 'No passing benchmark data is available for these runs.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientBenchmarkCard;
