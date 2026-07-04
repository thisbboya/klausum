export interface ParsedError {
  line: number | null;
  message: string;
}

export function parseErrorLine(stderr: string, language: string): ParsedError {
  if (!stderr) return { line: null, message: "" };

  // Python
  if (language === "python") {
    const all = [...stderr.matchAll(/line (\d+)/g)];
    if (all.length) {
      const last = all[all.length - 1];
      return { line: parseInt(last[1], 10), message: stderr.split("\n").filter(Boolean).pop() ?? stderr };
    }
  }

  // Java
  const javaMatch = stderr.match(/\.java:(\d+)\)/);
  if (javaMatch) return { line: parseInt(javaMatch[1], 10), message: stderr.split("\n")[0] };

  // C/C++
  const cMatch = stderr.match(/:(\d+):\d+:\s*(error|warning)/);
  if (cMatch) return { line: parseInt(cMatch[1], 10), message: stderr.split("\n")[0] };

  // Rust
  const rustMatch = stderr.match(/-->\s+[^:]+:(\d+):\d+/);
  if (rustMatch) return { line: parseInt(rustMatch[1], 10), message: stderr.split("\n")[0] };

  // JS/TS/Node
  const jsMatch = stderr.match(/:(\d+):\d+/);
  if (jsMatch) return { line: parseInt(jsMatch[1], 10), message: stderr.split("\n")[0] };

  return { line: null, message: stderr };
}
