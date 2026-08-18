/**
 * Safe arithmetic evaluator that evaluates basic arithmetic expressions
 * without using eval() or Function() constructor.
 * Supports +, -, *, /, %, unary +/-, and parentheses.
 */
export function safeEvaluateArithmetic(expression: string): number {
  if (!expression || typeof expression !== 'string') return 0;
  
  // Clean whitespace and normalize % to * 0.01 if present
  let expr = expression.replace(/%/g, ' * 0.01 ').trim();
  if (!expr) return 0;

  // Strict whitelist of allowed characters
  if (!/^[0-9.+\-*\/()\s]+$/.test(expr)) {
    return 0;
  }

  // Tokenizer
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const char = expr[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if ('+-*/()'.includes(char)) {
      tokens.push(char);
      i++;
    } else if (/[0-9.]/.test(char)) {
      let numStr = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      tokens.push(numStr);
    } else {
      return 0; // Invalid character
    }
  }

  // Recursive descent parser
  let tokenIdx = 0;

  function parseExpression(): number {
    let result = parseTerm();
    while (tokenIdx < tokens.length) {
      const op = tokens[tokenIdx];
      if (op === '+') {
        tokenIdx++;
        result += parseTerm();
      } else if (op === '-') {
        tokenIdx++;
        result -= parseTerm();
      } else {
        break;
      }
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (tokenIdx < tokens.length) {
      const op = tokens[tokenIdx];
      if (op === '*') {
        tokenIdx++;
        result *= parseFactor();
      } else if (op === '/') {
        tokenIdx++;
        const denom = parseFactor();
        result = denom === 0 ? 0 : result / denom;
      } else {
        break;
      }
    }
    return result;
  }

  function parseFactor(): number {
    if (tokenIdx >= tokens.length) return 0;
    const token = tokens[tokenIdx];

    // Unary minus or plus
    if (token === '+') {
      tokenIdx++;
      return parseFactor();
    }
    if (token === '-') {
      tokenIdx++;
      return -parseFactor();
    }

    if (token === '(') {
      tokenIdx++;
      const val = parseExpression();
      if (tokenIdx < tokens.length && tokens[tokenIdx] === ')') {
        tokenIdx++;
      }
      return val;
    }

    const num = Number(token);
    tokenIdx++;
    return isNaN(num) ? 0 : num;
  }

  try {
    const finalVal = parseExpression();
    return isFinite(finalVal) && !isNaN(finalVal) ? finalVal : 0;
  } catch (err) {
    return 0;
  }
}
