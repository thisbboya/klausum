// A small, safe evaluator for single-variable maths expressions.
//
// This exists specifically so we never call eval() or new Function() on a
// string the AI produced. Every published tutorial on "let the LLM plot a
// graph" does exactly that, and it is arbitrary code execution with the
// student's logged-in session in scope: one prompt-injected study material
// could exfiltrate their token through a formula. Parsing properly costs us
// ~120 lines and closes that hole completely.
//
// Supported: + - * / ^ %, unary minus, parentheses, the variable x, numeric
// literals, and the whitelisted constants/functions below. Anything else —
// an identifier we don't know, a stray character, unbalanced brackets — is a
// parse error, which the caller shows as "couldn't plot this" rather than
// running.

// Null-prototype maps, deliberately. With a plain object literal, `"constructor"
// in FUNCTIONS` is true — inherited from Object.prototype — so an expression
// containing `constructor`, `toString` or `__proto__` would sail through the
// whitelist and resolve to a prototype member instead of being rejected.
const FUNCTIONS: Record<string, (n: number) => number> = Object.assign(Object.create(null), {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  sign: Math.sign,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
});

const CONSTANTS: Record<string, number> = Object.assign(Object.create(null), {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
});

type Token =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "fn"; v: string }
  | { k: "op"; v: string }
  | { k: "("; }
  | { k: ")" };

/**
 * Turn the source into tokens, rejecting anything outside the grammar.
 *
 * `allowed` is the set of variable names this expression may reference. A plot
 * passes ["x"]; a simulation passes its declared parameters. Anything not in
 * that set and not a known constant or function is a hard error — which is
 * what keeps an unknown identifier from ever reaching evaluation.
 */
function tokenize(src: string, allowed: ReadonlySet<string>): Token[] {
  const out: Token[] = [];
  let i = 0;
  // Students write "2x" and "3sin(x)"; models write "2*x". We insert the
  // implicit multiply during parsing, so tokenize stays purely lexical.
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      // exponent notation: 1e-3
      if (/[eE]/.test(src[j] ?? "") && /[0-9+\-]/.test(src[j + 1] ?? "")) {
        j += 2;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) throw new Error(`Bad number near "${src.slice(i, j)}"`);
      out.push({ k: "num", v: n });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j).toLowerCase();
      // Declared variables win over constants, so a simulation may legitimately
      // call a parameter "e" without silently becoming Euler's number.
      if (allowed.has(word)) out.push({ k: "var", name: word });
      else if (word in CONSTANTS) out.push({ k: "num", v: CONSTANTS[word] });
      else if (word in FUNCTIONS) out.push({ k: "fn", v: word });
      else throw new Error(`Unknown name "${word}"`);
      i = j;
      continue;
    }
    if ("+-*/^%".includes(c)) {
      // "**" is the same as "^"
      if (c === "*" && src[i + 1] === "*") {
        out.push({ k: "op", v: "^" });
        i += 2;
        continue;
      }
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ k: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ k: ")" });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  return out;
}

type Node =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "fn"; name: string; arg: Node }
  | { t: "bin"; op: string; l: Node; r: Node }
  | { t: "neg"; v: Node };

/**
 * Recursive-descent parse into a tree, so evaluation later is a plain walk
 * with no string handling at all.
 *
 *   expr   := term (("+"|"-") term)*
 *   term   := unary (("*"|"/"|"%") unary | implicit-multiply)*
 *   unary  := "-" unary | power
 *   power  := atom ("^" unary)?            // right-associative: 2^3^2 = 2^9
 *   atom   := num | "x" | fn "(" expr ")" | "(" expr ")"
 */
function parse(tokens: Token[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const eat = () => tokens[p++];

  const expr = (): Node => {
    let left = term();
    while (peek()?.k === "op" && "+-".includes((peek() as any).v)) {
      const op = (eat() as any).v;
      left = { t: "bin", op, l: left, r: term() };
    }
    return left;
  };

  const term = (): Node => {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t?.k === "op" && "*/%".includes((t as any).v)) {
        const op = (eat() as any).v;
        left = { t: "bin", op, l: left, r: unary() };
      } else if (t && (t.k === "num" || t.k === "var" || t.k === "fn" || t.k === "(")) {
        // implicit multiplication: 2x, 3(x+1), 2sin(x)
        left = { t: "bin", op: "*", l: left, r: unary() };
      } else return left;
    }
  };

  const unary = (): Node => {
    const t = peek();
    if (t?.k === "op" && (t as any).v === "-") {
      eat();
      return { t: "neg", v: unary() };
    }
    if (t?.k === "op" && (t as any).v === "+") {
      eat();
      return unary();
    }
    return power();
  };

  const power = (): Node => {
    const base = atom();
    const t = peek();
    if (t?.k === "op" && (t as any).v === "^") {
      eat();
      return { t: "bin", op: "^", l: base, r: unary() };
    }
    return base;
  };

  const atom = (): Node => {
    const t = eat();
    if (!t) throw new Error("Expression ended early");
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "var") return { t: "var", name: t.name };
    if (t.k === "fn") {
      if (peek()?.k !== "(") throw new Error(`"${t.v}" needs brackets, e.g. ${t.v}(x)`);
      eat();
      const arg = expr();
      if (eat()?.k !== ")") throw new Error("Missing closing bracket");
      return { t: "fn", name: t.v, arg };
    }
    if (t.k === "(") {
      const inner = expr();
      if (eat()?.k !== ")") throw new Error("Missing closing bracket");
      return inner;
    }
    throw new Error("Expected a number, x, or bracket");
  };

  const tree = expr();
  if (p !== tokens.length) throw new Error("Unexpected trailing symbols");
  return tree;
}

type Scope = Record<string, number>;

function evalNode(n: Node, scope: Scope): number {
  switch (n.t) {
    case "num":
      return n.v;
    case "var":
      return scope[n.name] ?? NaN;
    case "neg":
      return -evalNode(n.v, scope);
    case "fn":
      return FUNCTIONS[n.name](evalNode(n.arg, scope));
    case "bin": {
      const a = evalNode(n.l, scope);
      const b = evalNode(n.r, scope);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "%": return a % b;
        case "^": return Math.pow(a, b);
        default: throw new Error(`Unknown operator ${n.op}`);
      }
    }
  }
}

/**
 * Compile once, evaluate many. Throws on a malformed expression so the caller
 * can show the source instead of a broken graph.
 */
export function compileExpression(src: string): (x: number) => number {
  const fn = compileScoped(src, ["x"]);
  return (x: number) => fn({ x });
}

/**
 * The multi-variable form, used by simulations: compile once against a set of
 * declared names, then evaluate against a scope of live slider values.
 */
export function compileScoped(
  src: string,
  variables: readonly string[],
): (scope: Scope) => number {
  const trimmed = src
    .trim()
    .replace(/^y\s*=\s*/i, "")
    .replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, "");
  if (!trimmed) throw new Error("Empty expression");
  if (trimmed.length > 500) throw new Error("Expression too long");
  const allowed = new Set(variables.map((v) => v.toLowerCase()));
  const tree = parse(tokenize(trimmed, allowed));
  return (scope: Scope) => evalNode(tree, scope);
}

/** Human-readable label for the legend, with the y= restored. */
export function prettyExpression(src: string): string {
  const body = src.trim().replace(/^y\s*=\s*/i, "").replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, "");
  return `y = ${body}`;
}
