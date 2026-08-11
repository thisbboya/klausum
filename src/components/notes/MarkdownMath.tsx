import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Diagram } from "@/components/reader/Diagram";

/**
 * The one markdown renderer every AI surface should use.
 *
 * Three things it does that a bare ReactMarkdown does not:
 *  - draws ```mermaid blocks as real diagrams instead of printing their source
 *  - renders GFM tables, task lists and strikethrough, which models emit
 *    constantly and which previously came out as raw pipes and dashes
 *  - carries the app's typography tokens, so headings and code look like
 *    Klausum rather than a plain-text dump
 */
export function MarkdownMath({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div className={`prose prose-sm max-w-none break-words ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code(props: any) {
            const { className: cls, children, ...rest } = props;
            const lang = /language-(\w+)/.exec(cls || "")?.[1];
            const text = String(children ?? "").replace(/\n$/, "");
            if (lang === "mermaid") return <Diagram code={text} />;
            return (
              <code className={cls} {...rest}>
                {children}
              </code>
            );
          },
          // Wide tables scroll inside their own box rather than widening the page.
          table({ children }) {
            return (
              <div className="not-prose my-3 overflow-x-auto rounded-xl border-2 border-border">
                <table className="w-full text-sm [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-extrabold">
                  {children}
                </table>
              </div>
            );
          },
        }}
      >
        {source || "_Empty_"}
      </ReactMarkdown>
    </div>
  );
}
