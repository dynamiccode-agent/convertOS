"use client";

import { useState } from "react";

interface Recommendation {
  id: string;
  type: string;
  entity_level: string;
  entity_id: string | null;
  reason: string;
  risk_level: string;
  preview: {
    current_state: string;
    proposed_state: string;
  };
  creative_variations?: Array<{
    primary_text: string;
    headline: string;
    description?: string;
    cta: string;
  }>;
}

interface AgentPanelProps {
  accountId: string;
  userEmail?: string;
}

export default function AgentPanel({ accountId, userEmail }: AgentPanelProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [monitorRecommendations, setMonitorRecommendations] = useState<Recommendation[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<string>("");
  const [dataFreshness, setDataFreshness] = useState<string>("unknown");
  const [executionResults, setExecutionResults] = useState<any>(null);
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set());

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setExecutionResults(null);
    try {
      const response = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, datePreset: 'last_7d' }),
      });

      const data = await response.json();

      if (response.ok) {
        setRecommendations(data.recommendations || []);
        setMonitorRecommendations(data.monitor_recommendations || []);
        setAnalysisSummary(data.analysis_summary || '');
        setDataFreshness(data.data_freshness || 'unknown');
        setSelectedRecs(new Set(data.recommendations.map((r: Recommendation) => r.id)));
      } else {
        alert(`Analysis failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    if (selectedRecs.size === 0) {
      alert('No recommendations selected');
      return;
    }

    if (!confirm(`Execute ${selectedRecs.size} recommendations?`)) {
      return;
    }

    setExecuting(true);
    setExecutionResults(null);

    try {
      const recsToExecute = recommendations.filter(r => selectedRecs.has(r.id));

      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          recommendations: recsToExecute,
          approvedBy: userEmail || 'user',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setExecutionResults(data);
        alert(`✅ Executed ${data.executed} of ${selectedRecs.size} recommendations`);
      } else {
        alert(`Execution failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Execution failed: ${error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedRecs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecs(newSelected);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          AI Recommendations
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Deckmasters Ad Account
        </p>
      </div>

      {/* Action Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {analyzing ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <span>🔍</span>
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* Summary */}
      {analysisSummary && (
        <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${
          dataFreshness === 'stale' 
            ? 'bg-red-50 dark:bg-red-900/20' 
            : 'bg-blue-50 dark:bg-blue-900/20'
        }`}>
          <p className={`text-sm ${
            dataFreshness === 'stale'
              ? 'text-red-900 dark:text-red-100'
              : 'text-blue-900 dark:text-blue-100'
          }`}>
            {analysisSummary}
          </p>
          {dataFreshness === 'stale' && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-2 font-semibold">
              ⚠️ Execution blocked - sync required before making changes
            </p>
          )}
        </div>
      )}

      {/* Recommendations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {recommendations.length === 0 && monitorRecommendations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-2">💡</p>
            <p className="text-sm">Click "Run Analysis" to get AI-powered recommendations</p>
          </div>
        ) : (
          <>
            {/* Actionable Recommendations */}
            {recommendations.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Actionable ({recommendations.length})</h3>
                {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`border rounded-lg p-4 ${selectedRecs.has(rec.id) ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/10' : 'border-gray-200 dark:border-gray-700'}`}
            >
              {/* Checkbox + Risk Level */}
              <div className="flex items-start gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={selectedRecs.has(rec.id)}
                  onChange={() => toggleSelection(rec.id)}
                  className="mt-1 h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded border ${getRiskColor(rec.risk_level)}`}>
                      {rec.risk_level.toUpperCase()} RISK
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{rec.type.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  
                  {/* Reason */}
                  <p className="text-sm text-gray-900 dark:text-white mb-3">{rec.reason}</p>
                  
                  {/* Preview */}
                  <div className="text-xs space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500">Current:</span>
                      <span className="text-gray-700 dark:text-gray-300">{rec.preview.current_state}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-violet-600">Proposed:</span>
                      <span className="text-gray-900 dark:text-white font-medium">{rec.preview.proposed_state}</span>
                    </div>
                  </div>

                  {/* Creative Variations (if any) */}
                  {rec.creative_variations && rec.creative_variations.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Creative Variations:</p>
                      {rec.creative_variations.map((variant, idx) => (
                        <div key={idx} className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          <div className="font-medium text-gray-900 dark:text-white">{variant.headline}</div>
                          <div className="text-gray-600 dark:text-gray-400 mt-1">{variant.primary_text}</div>
                          {variant.description && (
                            <div className="text-gray-500 dark:text-gray-500 mt-1">{variant.description}</div>
                          )}
                          <div className="mt-1 text-violet-600 dark:text-violet-400">CTA: {variant.cta}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
              </div>
            )}

            {/* Monitor Recommendations (not actionable yet) */}
            {monitorRecommendations.length > 0 && (
              <div className="space-y-4 mt-6">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Monitor (insufficient data) ({monitorRecommendations.length})</h3>
                {monitorRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 opacity-75"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold px-2 py-1 rounded border border-gray-400 bg-gray-100 text-gray-700">
                            MONITOR
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {rec.type?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{rec.reason}</p>
                        
                        <div className="text-xs space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500">Current:</span>
                            <span className="text-gray-600 dark:text-gray-400">{rec.preview.current_state}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500">Action:</span>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{rec.preview.proposed_state}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Execute Button */}
      {recommendations.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleExecute}
            disabled={executing || selectedRecs.size === 0 || dataFreshness === 'stale'}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {executing ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Executing...
              </>
            ) : (
              <>
                <span>✓</span>
                Approve & Execute ({selectedRecs.size})
              </>
            )}
          </button>
          {executionResults && (
            <div className="mt-3 text-sm text-center">
              {executionResults.success ? (
                <span className="text-green-600">✓ {executionResults.executed} executed successfully</span>
              ) : (
                <span className="text-red-600">✗ Execution failed</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
