import { Database } from 'lucide-react';

interface VariablesPanelProps {
  variables: Record<string, any>;
}

export function VariablesPanel({ variables }: VariablesPanelProps) {
  const entries = Object.entries(variables);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
        <Database size={18} className="text-slate-600" />
        <h2 className="font-semibold text-slate-700">Variables</h2>
      </div>
      <div className="p-4">
        {entries.length === 0 ? (
          <div className="text-slate-400 text-sm">No variables yet</div>
        ) : (
          <div className="space-y-2">
            {entries.map(([name, value]) => (
              <div key={name} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                <span className="font-mono text-sm font-semibold text-slate-700">{name}</span>
                <span className="font-mono text-sm text-slate-600">
                  {typeof value === 'string' ? `"${value}"` : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
