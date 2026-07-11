import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { fetcher } from '../lib/api';
import { MessageSquare, Check, X, Bot, User, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

type CheckName = 'TESTS' | 'SIZE' | 'STYLE' | 'DESCRIPTION';

interface ReviewItem {
  id: string;
  triggerEvent: string;
  commented: boolean;
  aiUsed: boolean;
  isMilestone: boolean;
  createdAt: string;
  pullRequest: {
    githubPrNumber: number;
    title: string;
    state: string;
  };
  contributor: {
    username: string;
    avatarUrl: string | null;
    totalPrs: number;
  };
  checkResults: {
    checkName: CheckName;
    passed: boolean;
    message: string | null;
  }[];
}

interface ReviewsResponse {
  reviews: ReviewItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function Reviews() {
  const { selectedRepoId, selectedRepo } = useOutletContext<{
    selectedRepoId: string | null;
    selectedRepo: { id: string; name: string; fullName: string; owner: string } | undefined;
  }>();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<ReviewsResponse>({
    queryKey: ['reviews', selectedRepoId, page],
    queryFn: () => fetcher(`/dashboard/repos/${selectedRepoId}/reviews?page=${page}&limit=20`),
    enabled: !!selectedRepoId,
  });

  if (!selectedRepoId) {
    return (
      <div className="text-slate-500 text-center mt-12">Select a repository to view reviews.</div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="h-64 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (isError || !data) {
    return <div className="text-red-500 p-4 bg-red-50 rounded-lg">Failed to load reviews.</div>;
  }

  if (data.reviews.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
        <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900">No reviews yet</h3>
        <p className="text-slate-500 mt-1">
          When a PR is opened, the bot's review will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Recent Reviews</h1>
        <p className="text-slate-500 mt-1">
          Complete history of bot activity on {selectedRepo?.name}.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {data.reviews.map((review) => (
            <li key={review.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {review.contributor.avatarUrl ? (
                      <img
                        src={review.contributor.avatarUrl}
                        className="w-10 h-10 rounded-full"
                        alt=""
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-500" />
                      </div>
                    )}
                  </div>

                  {/* PR Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">
                        {review.contributor.username}
                      </span>
                      <span className="text-slate-400 text-sm">
                        PR #{review.pullRequest.githubPrNumber}
                      </span>
                      {review.isMilestone && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Milestone ({review.contributor.totalPrs} PRs)
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-700 mb-3">
                      {review.pullRequest.title}
                    </div>

                    {/* Checks Row */}
                    <div className="flex flex-wrap gap-2">
                      {review.checkResults.map((check) => (
                        <div
                          key={check.checkName}
                          className={clsx(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium',
                            check.passed
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-red-50 border-red-200 text-red-700',
                          )}
                          title={check.message || ''}
                        >
                          {check.passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {check.checkName}
                        </div>
                      ))}
                      {review.checkResults.length === 0 && (
                        <span className="text-xs text-slate-400 border border-slate-200 px-2 py-1 rounded-md">
                          No checks ran
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status indicator on far right */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-xs text-slate-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </div>
                  <div
                    className={clsx(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                      review.commented ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {review.commented ? (
                      <>
                        <MessageSquare className="w-3.5 h-3.5" />
                        Commented
                        {review.aiUsed && (
                          <span className="opacity-75 relative -top-0.5 ml-0.5">✨</span>
                        )}
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 opacity-50" />
                        Silent
                      </>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
