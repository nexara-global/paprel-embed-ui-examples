import { createElement, type HTMLAttributes } from "react";

type EmbedProps = HTMLAttributes<HTMLElement> & Record<string, unknown>;

export function EmbedElement({ tag, ...props }: EmbedProps & { tag: string }) {
  return createElement(tag, props);
}
