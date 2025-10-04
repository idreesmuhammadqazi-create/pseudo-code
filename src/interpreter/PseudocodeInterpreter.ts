interface ExecutionState {
  variables: Record<string, any>;
  currentLine: number;
  finished: boolean;
  callStack: Array<{
    line: number;
    type: string;
    condition?: string;
    loopVar?: string;
    loopEnd?: number;
    returnLine?: number;
    savedVariables?: Record<string, any>;
    functionName?: string;
  }>;
}

interface FunctionDefinition {
  name: string;
  params: string[];
  startLine: number;
  endLine: number;
}

export class PseudocodeInterpreter {
  private lines: string[];
  private state: ExecutionState;
  private outputCallback: (message: string) => void;
  private functions: Map<string, FunctionDefinition>;

  constructor(code: string, outputCallback: (message: string) => void) {
    this.lines = code.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    this.state = {
      variables: {},
      currentLine: 0,
      finished: false,
      callStack: [],
    };
    this.outputCallback = outputCallback;
    this.functions = new Map();
    this.parseFunctions();
  }

  private parseFunctions(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(/^FUNCTION\s+(\w+)\s*\(([^)]*)\)/i);
      if (match) {
        const funcName = match[1];
        const params = match[2].split(',').map(p => p.trim()).filter(p => p.length > 0);
        const endLine = this.findMatchingEnd('FUNCTION', i);
        this.functions.set(funcName, {
          name: funcName,
          params,
          startLine: i,
          endLine,
        });
      }
    }
  }

  step(): ExecutionState {
    if (this.state.finished || this.state.currentLine >= this.lines.length) {
      this.state.finished = true;
      return { ...this.state };
    }

    const line = this.lines[this.state.currentLine];
    this.executeLine(line);

    return { ...this.state };
  }

  private executeLine(line: string): void {
    const upperLine = line.toUpperCase();

    if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
      this.state.currentLine++;
      return;
    }

    const arrowAssignMatch = line.match(/^(\w+(?:\[\w+\])?)\s*←\s*(.+)$/);
    if (arrowAssignMatch) {
      const target = arrowAssignMatch[1];
      const expression = arrowAssignMatch[2];

      const arrayMatch = target.match(/(\w+)\[(.+)\]/);
      if (arrayMatch) {
        const arrayName = arrayMatch[1];
        const indexExpr = arrayMatch[2];
        const index = this.evaluateExpression(indexExpr);
        const value = this.evaluateExpression(expression);

        if (!this.state.variables[arrayName]) {
          this.state.variables[arrayName] = [];
        }
        this.state.variables[arrayName][index] = value;
      } else {
        this.state.variables[target] = this.evaluateExpression(expression);
      }
      this.state.currentLine++;
      return;
    }

    if (upperLine.startsWith('SET ')) {
      const match = line.match(/SET\s+(\w+(?:\[\w+\])?)\s+TO\s+(.+)/i);
      if (match) {
        const target = match[1];
        const expression = match[2];

        const arrayMatch = target.match(/(\w+)\[(.+)\]/);
        if (arrayMatch) {
          const arrayName = arrayMatch[1];
          const indexExpr = arrayMatch[2];
          const index = this.evaluateExpression(indexExpr);
          const value = this.evaluateExpression(expression);

          if (!this.state.variables[arrayName]) {
            this.state.variables[arrayName] = [];
          }
          this.state.variables[arrayName][index] = value;
        } else {
          this.state.variables[target] = this.evaluateExpression(expression);
        }
      }
      this.state.currentLine++;
    }
    else if (upperLine.startsWith('OUTPUT ')) {
      const expression = line.substring(7).trim();
      const value = this.evaluateExpression(expression);
      this.outputCallback(String(value));
      this.state.currentLine++;
    }
    else if (upperLine.startsWith('IF ')) {
      const match = line.match(/IF\s+(.+)\s+THEN/i);
      if (match) {
        const condition = match[1];
        const result = this.evaluateCondition(condition);
        if (result) {
          this.state.callStack.push({ line: this.state.currentLine, type: 'IF', condition });
          this.state.currentLine++;
        } else {
          this.state.currentLine = this.findMatchingEnd('IF', this.state.currentLine) + 1;
        }
      }
    }
    else if (upperLine === 'END IF') {
      const block = this.state.callStack[this.state.callStack.length - 1];
      if (block && block.type === 'IF') {
        this.state.callStack.pop();
      }
      this.state.currentLine++;
    }
    else if (upperLine.startsWith('WHILE ')) {
      const match = line.match(/WHILE\s+(.+)\s+DO/i);
      if (match) {
        const condition = match[1];
        const result = this.evaluateCondition(condition);

        const existingLoop = this.state.callStack.find(
          block => block.line === this.state.currentLine && block.type === 'WHILE'
        );

        if (result) {
          if (!existingLoop) {
            this.state.callStack.push({ line: this.state.currentLine, type: 'WHILE', condition });
          }
          this.state.currentLine++;
        } else {
          if (existingLoop) {
            this.state.callStack.pop();
          }
          this.state.currentLine = this.findMatchingEnd('WHILE', this.state.currentLine) + 1;
        }
      }
    }
    else if (upperLine === 'END WHILE') {
      const block = this.state.callStack[this.state.callStack.length - 1];
      if (block && block.type === 'WHILE') {
        this.state.currentLine = block.line;
      } else {
        this.state.currentLine++;
      }
    }
    else if (upperLine.startsWith('FOR ')) {
      const matchArrow = line.match(/FOR\s+(\w+)\s*←\s*(.+)\s+TO\s+(.+)/i);
      const matchFrom = line.match(/FOR\s+(\w+)\s+FROM\s+(.+)\s+TO\s+(.+)\s+DO/i);

      if (matchArrow || matchFrom) {
        const match = matchArrow || matchFrom;
        const varName = match![1];
        const startExpr = match![2];
        const endExpr = match![3];

        const existingLoop = this.state.callStack.find(
          block => block.line === this.state.currentLine && block.type === 'FOR'
        );

        if (!existingLoop) {
          const start = this.evaluateExpression(startExpr);
          const end = this.evaluateExpression(endExpr);
          this.state.variables[varName] = start;
          this.state.callStack.push({ line: this.state.currentLine, type: 'FOR', loopVar: varName, loopEnd: end });
          this.state.currentLine++;
        } else {
          const currentVal = this.state.variables[existingLoop.loopVar!];
          if (currentVal <= existingLoop.loopEnd!) {
            this.state.currentLine++;
          } else {
            this.state.callStack.pop();
            this.state.currentLine = this.findMatchingEnd('FOR', this.state.currentLine) + 1;
          }
        }
      }
    }
    else if (upperLine === 'END FOR' || upperLine.startsWith('NEXT ')) {
      const block = this.state.callStack[this.state.callStack.length - 1];
      if (block && block.type === 'FOR') {
        this.state.variables[block.loopVar!]++;
        this.state.currentLine = block.line;
      } else {
        this.state.currentLine++;
      }
    }
    else if (upperLine.startsWith('FUNCTION ')) {
      const funcDef = this.functions.get(line.match(/FUNCTION\s+(\w+)/i)![1]);
      if (funcDef) {
        this.state.currentLine = funcDef.endLine + 1;
      } else {
        this.state.currentLine++;
      }
    }
    else if (upperLine === 'ENDFUNCTION' || upperLine === 'END FUNCTION') {
      this.state.currentLine++;
    }
    else if (upperLine.startsWith('RETURN')) {
      const returnMatch = line.match(/RETURN\s+(.+)/i);
      const returnValue = returnMatch ? this.evaluateExpression(returnMatch[1]) : undefined;

      const functionBlock = [...this.state.callStack].reverse().find(block => block.type === 'FUNCTION_CALL');

      if (functionBlock) {
        if (returnValue !== undefined) {
          this.state.variables['__return__'] = returnValue;
        }

        const savedVars = functionBlock.savedVariables || {};
        this.state.variables = { ...savedVars };
        if (returnValue !== undefined) {
          this.state.variables['__return__'] = returnValue;
        }

        while (this.state.callStack.length > 0) {
          const block = this.state.callStack.pop();
          if (block!.type === 'FUNCTION_CALL') {
            this.state.currentLine = block!.returnLine!;
            break;
          }
        }
      } else {
        this.state.currentLine++;
      }
    }
    else if (upperLine === 'ELSE') {
      this.state.currentLine = this.findMatchingEnd('IF',
        this.state.callStack[this.state.callStack.length - 1]?.line || this.state.currentLine) + 1;
    }
    else if (upperLine === 'ENDIF') {
      const block = this.state.callStack[this.state.callStack.length - 1];
      if (block && block.type === 'IF') {
        this.state.callStack.pop();
      }
      this.state.currentLine++;
    }
    else {
      this.state.currentLine++;
    }

    if (this.state.currentLine >= this.lines.length) {
      this.state.finished = true;
    }
  }

  private findMatchingEnd(blockType: string, startLine: number): number {
    let depth = 1;
    const startKeyword = blockType;
    const endKeyword = `END ${blockType}`;
    const altEndKeyword = `END${blockType}`;
    const nextKeyword = blockType === 'FOR' ? 'NEXT' : null;
    const elseKeyword = blockType === 'IF' ? 'ELSE' : null;

    for (let i = startLine + 1; i < this.lines.length; i++) {
      const line = this.lines[i].toUpperCase();
      if (line.startsWith(startKeyword + ' ')) {
        depth++;
      } else if (line === endKeyword || line === altEndKeyword || (nextKeyword && line.startsWith(nextKeyword + ' '))) {
        depth--;
        if (depth === 0) {
          return i;
        }
      } else if (elseKeyword && line === elseKeyword && depth === 1) {
        return i;
      }
    }
    return this.lines.length;
  }

  private evaluateExpression(expr: string): any {
    expr = expr.trim();

    if (expr.startsWith('"') && expr.endsWith('"')) {
      return expr.slice(1, -1);
    }

    if (expr.startsWith('[') && expr.endsWith(']')) {
      const items = expr.slice(1, -1).split(',').map(item => this.evaluateExpression(item.trim()));
      return items;
    }

    const funcCallMatch = expr.match(/^(\w+)\s*\(([^)]*)\)$/);
    if (funcCallMatch) {
      const funcName = funcCallMatch[1];
      const argsStr = funcCallMatch[2];
      const args = argsStr ? argsStr.split(',').map(arg => this.evaluateExpression(arg.trim())) : [];

      const funcDef = this.functions.get(funcName);
      if (funcDef) {
        const savedVariables = { ...this.state.variables };

        const newVariables: Record<string, any> = {};
        for (let i = 0; i < funcDef.params.length; i++) {
          newVariables[funcDef.params[i]] = args[i];
        }
        this.state.variables = newVariables;

        this.state.callStack.push({
          line: funcDef.startLine,
          type: 'FUNCTION_CALL',
          returnLine: this.state.currentLine,
          savedVariables,
          functionName: funcName,
        });

        this.state.currentLine = funcDef.startLine + 1;

        while (this.state.currentLine <= funcDef.endLine) {
          const line = this.lines[this.state.currentLine];
          const upperLine = line.toUpperCase();

          if (upperLine.startsWith('RETURN')) {
            const returnMatch = line.match(/RETURN\s+(.+)/i);
            const returnValue = returnMatch ? this.evaluateExpression(returnMatch[1]) : undefined;

            this.state.callStack.pop();
            this.state.variables = savedVariables;
            this.state.currentLine = this.state.callStack[this.state.callStack.length - 1]?.returnLine || this.state.currentLine;

            return returnValue;
          } else if (upperLine === 'ENDFUNCTION' || upperLine === 'END FUNCTION') {
            break;
          } else {
            this.executeLine(line);
          }
        }

        this.state.callStack.pop();
        this.state.variables = savedVariables;

        return this.state.variables['__return__'];
      }
    }

    if (expr.includes('+') && expr.includes('"')) {
      const parts: string[] = [];
      let current = '';
      let inString = false;
      let parenDepth = 0;

      for (let i = 0; i < expr.length; i++) {
        const char = expr[i];

        if (char === '"') {
          inString = !inString;
          current += char;
        } else if (char === '(' && !inString) {
          parenDepth++;
          current += char;
        } else if (char === ')' && !inString) {
          parenDepth--;
          current += char;
        } else if (char === '+' && !inString && parenDepth === 0) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      if (current.trim()) {
        parts.push(current.trim());
      }

      let result = '';
      for (const part of parts) {
        const evaluated = this.evaluateExpression(part);
        result += String(evaluated);
      }
      return result;
    }

    let processedExpr = expr;

    processedExpr = processedExpr.replace(/(\w+)\[([^\]]+)\]/g, (match, arrayName, indexExpr) => {
      const index = this.evaluateExpression(indexExpr);
      const array = this.state.variables[arrayName];
      if (array && Array.isArray(array)) {
        return String(array[index]);
      }
      return match;
    });

    for (const [varName, value] of Object.entries(this.state.variables)) {
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      if (Array.isArray(value)) {
        processedExpr = processedExpr.replace(regex, JSON.stringify(value));
      } else {
        const replacement = typeof value === 'string' ? `"${value}"` : String(value);
        processedExpr = processedExpr.replace(regex, replacement);
      }
    }

    try {
      const result = eval(processedExpr);
      return result;
    } catch {
      return processedExpr;
    }
  }

  private evaluateCondition(condition: string): boolean {
    condition = condition.trim();

    // Replace variables with their values
    let processedCondition = condition;
    for (const [varName, value] of Object.entries(this.state.variables)) {
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      processedCondition = processedCondition.replace(regex, String(value));
    }

    // Evaluate the condition
    try {
      return eval(processedCondition);
    } catch {
      return false;
    }
  }
}
