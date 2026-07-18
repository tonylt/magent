import type { PlatformKind, ShellViewModel, SemanticCommand } from "./contracts.ts";

function text(value: string): Text {
  return document.createTextNode(value);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (content) node.append(text(content));
  return node;
}

export function createProductionView({
  root,
  platform,
  dispatch,
}: {
  root: HTMLElement;
  platform: PlatformKind;
  dispatch: (command: SemanticCommand) => void;
}): (viewModel: ShellViewModel) => void {
  root.dataset.platform = platform;

  return (viewModel) => {
    root.replaceChildren();
    root.dataset.screen = viewModel.screen;

    const screen = element("main", "screen");
    screen.setAttribute("aria-label", viewModel.title);
    screen.append(element("div", "brand-rule"));

    const header = element("header", "header");
    header.append(element("strong", "title", viewModel.title));
    header.append(element("span", "status", viewModel.status));
    screen.append(header);

    const body = element("section", "body");
    if (viewModel.screen === "ready") {
      const list = element("div", "menu");
      list.setAttribute("role", "listbox");
      viewModel.items.forEach((item, index) => {
        const row = element("button", "menu-item");
        row.type = "button";
        row.setAttribute("role", "option");
        row.setAttribute("aria-current", index === viewModel.focus ? "true" : "false");
        row.setAttribute("aria-selected", index === viewModel.focus ? "true" : "false");
        row.append(element("span", "item-title", item.title));
        row.append(element("span", "item-detail", item.detail));
        row.addEventListener("click", () => dispatch({ type: "focus-at", index }));
        list.append(row);
      });
      body.append(list);
    } else {
      body.append(element("p", "safety-label", viewModel.status));
      const message = viewModel.screen === "checking"
        ? "CAPABILITY PROBE IN PROGRESS"
        : "DEVICE CAPABILITIES DO NOT ALLOW PASEO DATA";
      body.append(element("h1", "decision", message));
      if (viewModel.reasons.length > 0) {
        body.append(element("p", "reasons", viewModel.reasons.join(" / ")));
      }
    }
    screen.append(body);
    screen.append(element("footer", "footer", "CAPABILITY-FIRST SHELL"));
    root.append(screen);
  };
}
