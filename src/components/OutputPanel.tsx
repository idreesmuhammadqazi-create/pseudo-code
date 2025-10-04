import { Terminal } from 'lucide-react';

interface OutputPanelProps {
  output: string[];
}

export function OutputPanel({ output }: OutputPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
        <Terminal size={18} className="text-slate-600" />
        <h2 className="font-semibold text-slate-700">Output</h2>
      </div>
      <div className="p-4 font-mono text-sm bg-slate-950 text-emerald-400 rounded-b-lg" style={{ minHeight: '200px', maxHeight: '400px', overflowY: 'auto' }}>
        {output.length === 0 ? (
          <div className="text-slate-500">No output yet. Run your code to see results.</div>
        ) : (
          output.map((line, idx) => (
            <div key={idx} className="mb-1">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
