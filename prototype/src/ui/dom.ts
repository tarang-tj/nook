// Finding the page's elements, loudly: a missing id is a bug in index.html.
export const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
};

/** Show `text` in the element, or hide the element when there is none. */
export function say(id: string, text: string): void {
  const node = el(id);
  node.hidden = !text;
  if (node.textContent !== text) node.textContent = text;
}

/** Fill a list with one item per string, or hide it when there are none.
 * The list is only rebuilt when the words change, so a screen reader is not
 * told the same thing on every redraw. */
export function list(id: string, items: (string | { strong: string; rest: string })[]): void {
  const node = el(id);
  node.hidden = items.length === 0;
  const key = JSON.stringify(items);
  if (node.dataset.key === key) return;
  node.dataset.key = key;
  node.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      if (typeof item === "string") li.textContent = item;
      else {
        const b = document.createElement("b");
        b.textContent = item.strong;
        li.append(b, item.rest);
      }
      return li;
    }),
  );
}

/** Hand the person a file made in the browser. Nothing is uploaded. */
export function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
