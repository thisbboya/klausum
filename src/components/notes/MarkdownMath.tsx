import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function MarkdownMath({ source, className }: { source: string; className?: string }) {
  return (
    <div className={`prose prose-sm prose-invert max-w-none break-words ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {source || "_Empty_"}
      </ReactMarkdown>
    </div>
  );
}
