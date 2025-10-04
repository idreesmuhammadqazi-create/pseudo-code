interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  currentLine: number;
  disabled: boolean;
}

export function CodeEditor({ code, onChange, currentLine, disabled }: CodeEditorProps) {
  const lines = code.split('\n');

  return (
    <div className="relative">
      <div className="flex">
        <div className="bg-slate-50 px-4 py-4 text-right text-slate-400 text-sm font-mono select-none border-r border-slate-200">
          {lines.map((_, idx) => (
            <div
              key={idx}
              className={`leading-6 ${
                idx === currentLine ? 'text-emerald-600 font-bold' : ''
              }`}
            >
              {idx + 1}
            </div>
          ))}
        </div>
        <div className="flex-1 relative">
          {currentLine >= 0 && (
            <div
              className="absolute left-0 right-0 bg-emerald-50 border-l-4 border-emerald-500 pointer-events-none"
              style={{
                top: `${currentLine * 24}px`,
                height: '24px',
              }}
            />
          )}
          <textarea
            value={code}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-4 py-4 font-mono text-sm leading-6 bg-transparent resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '400px' }}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
