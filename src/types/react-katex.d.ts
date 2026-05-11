declare module "react-katex" {
  import * as React from "react";
  export const BlockMath: React.FC<{ math: string; errorColor?: string }>;
  export const InlineMath: React.FC<{ math: string; errorColor?: string }>;
}
