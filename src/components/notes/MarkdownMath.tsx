import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Diagram } from "@/components/reader/Diagram";
import { Plot } from "@/components/reader/Plot";
import { Simulation } from "@/components/reader/Simulation";
import { SceneBlock, SimRefBlock } from "@/components/sim/SceneBlock";

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
          // A fenced block always arrives as <pre><code>. For mermaid and plot
          // we replace the <code> with a <figure>, which would otherwise end up
          // nested inside that <pre> — invalid HTML, and it inherits
          // white-space:pre and the prose code-block background, which visibly
          // distorts the diagram. So the <pre> is dropped for those languages
          // and kept for genuine code.
          pre(props: any) {
            const child = Array.isArray(props.children) ? props.children[0] : props.children;
            const lang = /language-(\w+)/.exec(child?.props?.className || "")?.[1];
            if (
              lang === "mermaid" ||
              lang === "plot" ||
              lang === "graph" ||
              lang === "sim" ||
              lang === "simulation"
            ) {
              return <>{props.children}</>;
            }
            const { node, className, ...rest } = props;
            // A long code answer must scroll inside its own box. Without the
            // max-width clamp a wide line makes the <pre> as wide as it likes,
            // which widens the bubble, which widens the pane — and the whole
            // layout starts scrolling instead of the code.
            return (
              <pre
                {...rest}
                className={`${className ?? ""} max-w-full overflow-x-auto`}
              />
            );
          },
          code(props: any) {
            const { className: cls, children, ...rest } = props;
            const lang = /language-(\w+)/.exec(cls || "")?.[1];
            const text = String(children ?? "").replace(/\n$/, "");
            if (lang === "mermaid") return <Diagram code={text} />;
            if (lang === "plot" || lang === "graph") return <Plot code={text} />;
            if (lang === "sim" || lang === "simulation") return <Simulation code={text} />;
            // The drawn kinds: a scene the tutor authored, or a reference to
            // one of the hand-built simulations, which always beat a generated
            // one on the topics we have covered.
            if (lang === "scene") return <SceneBlock code={text} />;
            if (lang === "simref") return <SimRefBlock code={text} />;
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
