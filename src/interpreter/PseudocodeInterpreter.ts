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
  private inputCallback: (prompt: string) => string | null;
  private functions: Map<string, FunctionDefinition>;

  constructor(
    code: string,
    outputCallback: (message: string) => void,
    inputCallback?: (prompt: string) => string | null
  ) {
    this.lines = code.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    this.state = {
      variables: {},
      currentLine: 0,
      finished: false,
      callStack: [],
    };
    this.outputCallback = outputCallback;
    this.inputCallback = inputCallback || ((prompt) => window.prompt(prompt));
    this.functions = new Map();
    this.parseFunctions();
  }

  private parseFunctions(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const funcMatch = line.match(/^FUNCTION\s+(\w+)\s*\(([^)]*)\)/i);
      const procMatch = line.match(/^PROCEDURE\s+(\w+)\s*\(([^)]*)\)/i);
      const match = funcMatch || procMatch;

      if (match) {
        const funcName = match[1];
        const params = match[2].split(',').map(p => p.trim()).filter(p => p.length > 0);
        const blockType = funcMatch ? 'FUNCTION' : 'PROCEDURE';
        const endLine = this.findMatchingEnd(blockType, i);
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
    else if (upperLine.startsWith('OUTPUT ') || upperLine.startsWith('PRINT ')) {
      const keyword = upperLine.startsWith('OUTPUT ') ? 'OUTPUT ' : 'PRINT ';
      const expression = line.substring(keyword.length).trim();
      const value = this.evaluateExpression(expression);
      this.outputCallback(String(value));
      this.state.currentLine++;
    }
    else if (upperLine.startsWith('INPUT ')) {
      const match = line.match(/INPUT\s+(\w+)/i);
      if (match) {
        const varName = match[1];
        const promptMatch = line.match(/INPUT\s+\w+\s+WITH\s+"([^"]+)"/i);
        const promptText = promptMatch ? promptMatch[1] : `Enter value for ${varName}:`;

        const inputValue = this.inputCallback(promptText);
        if (inputValue !== null) {
          const numValue = parseFloat(inputValue);
          this.state.variables[varName] = isNaN(numValue) ? inputValue : numValue;
        }
      }
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
    else if (upperLine.startsWith('FUNCTION ') || upperLine.startsWith('PROCEDURE ')) {
      const funcMatch = line.match(/(?:FUNCTION|PROCEDURE)\s+(\w+)/i);
      if (funcMatch) {
        const funcDef = this.functions.get(funcMatch[1]);
        if (funcDef) {
          this.state.currentLine = funcDef.endLine + 1;
        } else {
          this.state.currentLine++;
        }
      } else {
        this.state.currentLine++;
      }
    }
    else if (upperLine === 'ENDFUNCTION' || upperLine === 'END FUNCTION' || upperLine === 'ENDPROCEDURE' || upperLine === 'END PROCEDURE') {
      this.state.currentLine++;
    }
    else if (upperLine.startsWith('CALL ')) {
      const callMatch = line.match(/CALL\s+(\w+)\s*\(([^)]*)\)/i);
      if (callMatch) {
        const funcName = callMatch[1];
        const argsStr = callMatch[2];
        const args = argsStr ? argsStr.split(',').map(arg => this.evaluateExpression(arg.trim())) : [];
        this.callFunction(funcName, args);
      }
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

  private callFunction(funcName: string, args: any[]): any {
    const funcDef = this.functions.get(funcName);
    if (!funcDef) {
      return undefined;
    }

    const savedVariables = { ...this.state.variables };
    const savedLine = this.state.currentLine;
    const savedCallStack = [...this.state.callStack];

    const newVariables: Record<string, any> = {};
    for (let i = 0; i < funcDef.params.length; i++) {
      newVariables[funcDef.params[i]] = args[i];
    }
    this.state.variables = newVariables;
    this.state.callStack = [];

    this.state.currentLine = funcDef.startLine + 1;

    let returnValue: any = undefined;

    while (this.state.currentLine <= funcDef.endLine) {
      const line = this.lines[this.state.currentLine];
      const upperLine = line.toUpperCase();

      if (upperLine.startsWith('RETURN')) {
        const returnMatch = line.match(/RETURN\s+(.+)/i);
        returnValue = returnMatch ? this.evaluateExpression(returnMatch[1]) : undefined;
        break;
      } else if (upperLine === 'ENDFUNCTION' || upperLine === 'END FUNCTION' || upperLine === 'ENDPROCEDURE' || upperLine === 'END PROCEDURE') {
        break;
      } else {
        this.executeLine(line);
      }
    }

    this.state.variables = savedVariables;
    this.state.currentLine = savedLine;
    this.state.callStack = savedCallStack;

    return returnValue;
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

    const builtInFunctions = ['LENGTH', 'LEN', 'SIZE'];
    let processedExpr = expr;
    let hasFunction = true;

    while (hasFunction) {
      hasFunction = false;
      processedExpr = processedExpr.replace(/(\w+)\s*\(([^()]*)\)/g, (match, funcName, argsStr) => {
        const upperFuncName = funcName.toUpperCase();

        if (builtInFunctions.includes(upperFuncName)) {
          hasFunction = true;
          const arg = argsStr.trim();
          const value = this.evaluateExpression(arg);
          if (Array.isArray(value)) {
            return String(value.length);
          }
          return String(0);
        }

        if (this.functions.has(funcName)) {
          hasFunction = true;
          const args = argsStr ? argsStr.split(',').map((arg: string) => this.evaluateExpression(arg.trim())) : [];
          const result = this.callFunction(funcName, args);
          return String(result);
        }
        return match;
      });
    }

    const arrayAccessPattern = /(\w+)\[([^\]]+)\]/g;
    let match;
    const replacements: { match: string; value: any }[] = [];

    while ((match = arrayAccessPattern.exec(processedExpr)) !== null) {
      const arrayName = match[1];
      const indexExpr = match[2];

      let indexValue: any;
      if (this.state.variables.hasOwnProperty(indexExpr)) {
        indexValue = this.state.variables[indexExpr];
      } else {
        try {
          indexValue = eval(indexExpr);
        } catch {
          indexValue = indexExpr;
        }
      }

      const array = this.state.variables[arrayName];
      if (array && Array.isArray(array)) {
        replacements.push({ match: match[0], value: array[indexValue] });
      }
    }

    for (const rep of replacements) {
      processedExpr = processedExpr.replace(rep.match, String(rep.value));
    }

    for (const [varName, value] of Object.entries(this.state.variables)) {
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      if (Array.isArray(value)) {
        processedExpr = processedExpr.replace(regex, JSON.stringify(value));
      } else {
        const replacement = typeof value === 'string' ? `"${value}"` : String(value);
        processedExpr = processedExpr.replace(regex, replacement);
      }
    }

    if (processedExpr.includes('+') && processedExpr.includes('"')) {
      const parts: string[] = [];
      let current = '';
      let inString = false;
      let parenDepth = 0;

      for (let i = 0; i < processedExpr.length; i++) {
        const char = processedExpr[i];

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
        if (part.startsWith('"') && part.endsWith('"')) {
          result += part.slice(1, -1);
        } else {
          try {
            result += String(eval(part));
          } catch {
            result += part;
          }
        }
      }
      return result;
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

    condition = condition.replace(/\bAND\b/gi, '&&');
    condition = condition.replace(/\bOR\b/gi, '||');
    condition = condition.replace(/\bNOT\b/gi, '!');
    condition = condition.replace(/\bMOD\b/gi, '%');

    let processedCondition = condition;
    for (const [varName, value] of Object.entries(this.state.variables)) {
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      processedCondition = processedCondition.replace(regex, String(value));
    }

    try {
      return eval(processedCondition);
    } catch {
      return false;
    }
  }
}
