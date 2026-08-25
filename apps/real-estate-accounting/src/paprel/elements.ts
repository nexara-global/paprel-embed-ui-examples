type ElementProps = Record<string, string | number | boolean | undefined>;

export function embedElement(tag: string, props: ElementProps = {}): HTMLElement {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (value === true) element.setAttribute(name, "");
    else element.setAttribute(name, String(value));
  }
  return element;
}

export function actionLink(to: string, label: string, className: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = to;
  link.dataset.route = "";
  link.className = className;
  link.textContent = label;
  return link;
}
