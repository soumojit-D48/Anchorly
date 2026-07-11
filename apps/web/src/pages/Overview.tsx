import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { fetcher } from '../lib/api';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, GitPullRequest, BotMessageSquare, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import { useMemo } from 'react';

interface StatsResponse {
  summary: {
    totalContributors: number;
    totalPRs: number;
    totalReviews: number;
    commentedReviews: number;
    silentReviews: number;
    totalBadges: number;
  };
  flagsOverTime: {
    date: string;
    prNumber: number;
    prTitle: string;
    contributor: string;
    totalFlags: number;
    totalChecks: number;
    commented: boolean;
    aiUsed: boolean;
    isMilestone: boolean;
  }[];
  checkStats: Record<string, { total: number; failed: number }>;
  topContributors: {
    username: string;
    avatarUrl: string | null;
    totalPrs: number;
    _count: { badges: number };
  }[];
}

export function Overview() {
  const { selectedRepoId } = useOutletContext<{
    selectedRepoId: string | null;
    selectedRepo: { id: string; name: string; fullName: string; owner: string } | undefined;
  }>();

  const { data, isLoading, isError } = useQuery<StatsResponse>({
    queryKey: ['stats', selectedRepoId],
    queryFn: () => fetcher(`/dashboard/repos/${selectedRepoId}/stats`),
    enabled: !!selectedRepoId,
  });

  // Transform data for recharts
  const chartData = useMemo(() => {
    if (!data) return [];

    // Group by day to smooth out the chart
    const dailyMap = new Map<string, { dateStr: string; totalFlags: number; prCount: number }>();

    data.flagsOverTime.forEach((review) => {
      const day = new Date(review.date).toLocaleDateString();
      const existing = dailyMap.get(day) || { dateStr: day, totalFlags: 0, prCount: 0 };
      existing.totalFlags += review.totalFlags;
      existing.prCount += 1;
      dailyMap.set(day, existing);
    });

    return Array.from(dailyMap.values()).map((d) => ({
      date: d.dateStr,
      avgFlags: d.prCount > 0 ? (d.totalFlags / d.prCount).toFixed(1) : 0,
      flags: d.totalFlags,
      prs: d.prCount,
    }));
  }, [data]);

  if (!selectedRepoId) {
    return (
      <div className="text-slate-500 text-center mt-12">Select a repository to view analytics.</div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        Failed to load repository statistics.
      </div>
    );
  }

  const { summary, checkStats, topContributors } = data;

  const statCards = [
    {
      label: 'Contributors',
      value: summary.totalContributors,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
    {
      label: 'Total PRs',
      value: summary.totalPRs,
      icon: GitPullRequest,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
    },
    {
      label: 'Bot Interventions',
      value: summary.commentedReviews,
      icon: BotMessageSquare,
      color: 'text-orange-500',
      bg: 'bg-orange-50',
    },
    {
      label: 'Silent Reviews',
      value: summary.silentReviews,
      icon: ShieldAlert,
      color: 'text-green-500',
      bg: 'bg-green-50',
    },
  ];

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics Overview</h1>
        <p className="text-slate-500 mt-1">High-level metrics and contributor growth trends.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4"
          >
            <div className={clsx('p-3 rounded-lg', stat.bg, stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Average Flags per PR</h2>
          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFlags" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    dy={10}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgFlags"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFlags)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                Not enough review data to chart.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {/* Check Failure Rates */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">
              Check Failure Rates
            </h2>
            <div className="space-y-4">
              {Object.entries(checkStats).map(([name, stats]) => {
                const failRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-700">{name}</span>
                      <span className="text-slate-500">{failRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-orange-400 h-2 rounded-full"
                        style={{ width: `${failRate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {Object.keys(checkStats).length === 0 && (
                <div className="text-sm text-slate-400">No checks run yet.</div>
              )}
            </div>
          </div>

          {/* Top Contributors */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">
              Top Contributors
            </h2>
            <ul className="space-y-4">
              {topContributors.map((contributor) => (
                <li key={contributor.username} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {contributor.avatarUrl ? (
                      <img src={contributor.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200" />
                    )}
                    <span className="text-sm font-medium text-slate-900">
                      {contributor.username}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    {contributor.totalPrs} PRs
                  </div>
                </li>
              ))}
              {topContributors.length === 0 && (
                <div className="text-sm text-slate-400">No contributors yet.</div>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
