import { useState, useEffect } from 'react';
import { Play, Square, SkipForward } from 'lucide-react';
import { PseudocodeInterpreter } from './interpreter/PseudocodeInterpreter';
import { CodeEditor } from './components/CodeEditor';
import { OutputPanel } from './components/OutputPanel';
import { VariablesPanel } from './components/VariablesPanel';

const defaultCode = `SET x TO 0
SET y TO 1
SET counter TO 0

WHILE counter < 10 DO
  OUTPUT "Fibonacci: " + y
  SET temp TO x + y
  SET x TO y
  SET y TO temp
  SET counter TO counter + 1
END WHILE

OUTPUT "Done!"`;

function App() {
  const [code, setCode] = useState(defaultCode);
  const [output, setOutput] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [currentLine, setCurrentLine] = useState<number>(-1);
  const [interpreter, setInterpreter] = useState<PseudocodeInterpreter | null>(null);

  useEffect(() => {
    if (isRunning && interpreter) {
      const timer = setTimeout(() => {
        const result = interpreter.step();
        if (result.finished) {
          setIsRunning(false);
          setCurrentLine(-1);
        } else {
          setCurrentLine(result.currentLine);
          setVariables({ ...result.variables });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isRunning, interpreter, output, variables]);

  const handleRun = () => {
    setOutput([]);
    setVariables({});
    setCurrentLine(-1);

    const newInterpreter = new PseudocodeInterpreter(code, (msg: string) => {
      setOutput(prev => [...prev, msg]);
    });

    setInterpreter(newInterpreter);
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    setCurrentLine(-1);
    setInterpreter(null);
  };

  const handleStepForward = () => {
    if (!interpreter) {
      const newInterpreter = new PseudocodeInterpreter(code, (msg: string) => {
        setOutput(prev => [...prev, msg]);
      });
      setInterpreter(newInterpreter);
      const result = newInterpreter.step();
      setCurrentLine(result.currentLine);
      setVariables({ ...result.variables });
      if (result.finished) {
        setCurrentLine(-1);
      }
    } else {
      const result = interpreter.step();
      setCurrentLine(result.currentLine);
      setVariables({ ...result.variables });
      if (result.finished) {
        setCurrentLine(-1);
        setInterpreter(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Pseudocode Interpreter</h1>
          <p className="text-slate-600">Write and execute pseudocode in real-time</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-700">Code Editor</h2>
                <div className="flex gap-2">
                  {!isRunning ? (
                    <>
                      <button
                        onClick={handleRun}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors"
                      >
                        <Play size={16} />
                        Run
                      </button>
                      <button
                        onClick={handleStepForward}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                      >
                        <SkipForward size={16} />
                        Step
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleStop}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                    >
                      <Square size={16} />
                      Stop
                    </button>
                  )}
                </div>
              </div>
              <CodeEditor
                code={code}
                onChange={setCode}
                currentLine={currentLine}
                disabled={isRunning}
              />
            </div>

            <OutputPanel output={output} />
          </div>

          <div className="space-y-6">
            <VariablesPanel variables={variables} />

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Supported Syntax</h3>
              <div className="text-sm text-slate-600 space-y-2">
                <div><code className="bg-slate-100 px-1 rounded">var ← value</code> or <code className="bg-slate-100 px-1 rounded">SET var TO value</code></div>
                <div><code className="bg-slate-100 px-1 rounded">arr ← [1, 2, 3]</code> or <code className="bg-slate-100 px-1 rounded">arr[i] ← value</code></div>
                <div><code className="bg-slate-100 px-1 rounded">OUTPUT expression</code></div>
                <div><code className="bg-slate-100 px-1 rounded">IF condition THEN ... ELSE ... ENDIF</code></div>
                <div><code className="bg-slate-100 px-1 rounded">WHILE condition DO ... END WHILE</code></div>
                <div><code className="bg-slate-100 px-1 rounded">FOR i ← 0 TO 5 ... NEXT i</code></div>
                <div><code className="bg-slate-100 px-1 rounded">FUNCTION name(params) ... RETURN value ... ENDFUNCTION</code></div>
                <div><code className="bg-slate-100 px-1 rounded"># comment</code></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
