import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { fetcher } from '../lib/api';
import { Save } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

interface RepoSettings {
  testsCheckEnabled: boolean;
  sizeCheckEnabled: boolean;
  styleCheckEnabled: boolean;
  descriptionCheckEnabled: boolean;
  maxDiffLines: number;
  goodFirstIssueLabel: string | null;
  veteranPrThreshold: number;
}

export function Settings() {
  const { selectedRepoId } = useOutletContext<{
    selectedRepoId: string | null;
    selectedRepo: { id: string; name: string; fullName: string; owner: string } | undefined;
  }>();
  const queryClient = useQueryClient();

  const {
    data: settings,
    isLoading,
    isError,
  } = useQuery<RepoSettings>({
    queryKey: ['settings', selectedRepoId],
    queryFn: () => fetcher(`/dashboard/repos/${selectedRepoId}/settings`),
    enabled: !!selectedRepoId,
  });

  const [formData, setFormData] = useState<RepoSettings | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (newSettings: Partial<RepoSettings>) =>
      fetcher(`/dashboard/repos/${selectedRepoId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(newSettings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', selectedRepoId] });
    },
  });

  if (!selectedRepoId) {
    return (
      <div className="text-slate-500 text-center mt-12">Select a repository to view settings.</div>
    );
  }

  if (isLoading || !formData) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="h-64 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        Failed to load repository settings.
      </div>
    );
  }

  const handleToggle = (key: keyof RepoSettings) => {
    setFormData({ ...formData, [key]: !formData[key] });
  };

  const handleSave = () => {
    mutation.mutate(formData);
  };

  const isDirty = JSON.stringify(settings) !== JSON.stringify(formData);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Repository Settings</h1>
          <p className="text-slate-500 mt-1">
            Configure how the bot reviews pull requests for this repository.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || mutation.isPending}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
            isDirty
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-8">
        {/* Review Checks */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-900">Active Checks</h2>
            <p className="text-sm text-slate-500 mt-1">
              Select which rule-based checks should run on pull requests.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            <ToggleRow
              title="Missing Tests"
              description="Warn if the PR adds new code without adding corresponding tests."
              enabled={formData.testsCheckEnabled}
              onToggle={() => handleToggle('testsCheckEnabled')}
            />
            <ToggleRow
              title="PR Size"
              description="Warn if the diff is larger than the configured max line count."
              enabled={formData.sizeCheckEnabled}
              onToggle={() => handleToggle('sizeCheckEnabled')}
            />
            <ToggleRow
              title="Code Style"
              description="Leave gentle suggestions on common styling or best-practice issues."
              enabled={formData.styleCheckEnabled}
              onToggle={() => handleToggle('styleCheckEnabled')}
            />
            <ToggleRow
              title="PR Description"
              description="Ensure the PR has a meaningful description beyond the default template."
              enabled={formData.descriptionCheckEnabled}
              onToggle={() => handleToggle('descriptionCheckEnabled')}
            />
          </div>
        </div>

        {/* Configuration Values */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-900">Variables</h2>
            <p className="text-sm text-slate-500 mt-1">
              Fine-tune the behavior of the checks and adaptive silence.
            </p>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Max Diff Lines (Size Check)
              </label>
              <input
                type="number"
                disabled={!formData.sizeCheckEnabled}
                value={formData.maxDiffLines}
                onChange={(e) =>
                  setFormData({ ...formData, maxDiffLines: parseInt(e.target.value) || 500 })
                }
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Veteran PR Threshold
              </label>
              <p className="text-xs text-slate-500 mb-2">
                After this many PRs, the bot will stay silent unless a check fails.
              </p>
              <input
                type="number"
                value={formData.veteranPrThreshold}
                onChange={(e) =>
                  setFormData({ ...formData, veteranPrThreshold: parseInt(e.target.value) || 10 })
                }
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Good First Issue Label (Optional)
              </label>
              <p className="text-xs text-slate-500 mb-2">
                If provided, the bot can auto-recommend issues to new contributors.
              </p>
              <input
                type="text"
                value={formData.goodFirstIssueLabel || ''}
                placeholder="e.g. good first issue"
                onChange={(e) =>
                  setFormData({ ...formData, goodFirstIssueLabel: e.target.value || null })
                }
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-6">
      <div>
        <h3 className="text-sm font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
          enabled ? 'bg-blue-600' : 'bg-slate-200',
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            enabled ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
