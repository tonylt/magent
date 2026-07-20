import { Fragment, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

import { classifyLine, parseInline, type MarkdownBlock } from "../lib/markdown";
import { colors, font, radius, space } from "../theme";

function InlineText({ line, base }: { line: string; base: StyleProp<TextStyle> }) {
  return (
    <Text style={base}>
      {parseInline(line).map((token, index) => (
        <Fragment key={index}>
          {token.code ? (
            <Text style={styles.code}>{token.text}</Text>
          ) : token.bold ? (
            <Text style={styles.bold}>{token.text}</Text>
          ) : (
            token.text
          )}
        </Fragment>
      ))}
    </Text>
  );
}

/** Render a subset of Markdown (headings, bullets, ordered lists, code fences, bold,
 * inline code) as React Native text. Dependency-free. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let fence: string[] | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (fence) {
        const codeLines = fence;
        nodes.push(
          <View key={`code-${index}`} style={styles.codeBlock}>
            <Text style={styles.codeBlockText}>{codeLines.join("\n")}</Text>
          </View>,
        );
        fence = null;
      } else {
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(line);
      continue;
    }
    if (trimmed.length === 0) {
      nodes.push(<View key={`sp-${index}`} style={styles.spacer} />);
      continue;
    }
    const block: MarkdownBlock = classifyLine(line);
    if (block.type === "bullet") {
      nodes.push(
        <View key={index} style={styles.listRow}>
          <Text style={styles.bulletMark}>•</Text>
          <InlineText line={block.text} base={styles.paragraph} />
        </View>,
      );
      continue;
    }
    if (block.type === "ordered") {
      nodes.push(
        <View key={index} style={styles.listRow}>
          <Text style={styles.orderedMark}>{block.marker}</Text>
          <InlineText line={block.text} base={styles.paragraph} />
        </View>,
      );
      continue;
    }
    const style =
      block.type === "heading1"
        ? styles.h1
        : block.type === "heading2"
          ? styles.h2
          : block.type === "heading3"
            ? styles.h3
            : styles.paragraph;
    nodes.push(<InlineText key={index} line={block.text} base={style} />);
  }

  if (fence) {
    const codeLines = fence;
    nodes.push(
      <View key="code-end" style={styles.codeBlock}>
        <Text style={styles.codeBlockText}>{codeLines.join("\n")}</Text>
      </View>,
    );
  }

  return <View style={styles.container}>{nodes}</View>;
}

const styles = StyleSheet.create({
  container: { gap: space.xs },
  paragraph: { color: colors.text, fontSize: font.size.md, lineHeight: 22 },
  h1: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.bold, marginTop: space.xs },
  h2: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold, marginTop: space.xs },
  h3: { color: colors.textDim, fontSize: font.size.md, fontWeight: font.weight.bold },
  bold: { fontWeight: font.weight.bold, color: colors.text },
  code: { fontFamily: font.mono, fontSize: font.size.sm, color: colors.accent },
  codeBlock: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
  },
  codeBlockText: { fontFamily: font.mono, fontSize: font.size.sm, color: colors.textDim, lineHeight: 18 },
  listRow: { flexDirection: "row", gap: space.sm, paddingLeft: space.xs },
  bulletMark: { color: colors.accent, fontSize: font.size.md, lineHeight: 22 },
  orderedMark: { color: colors.accent, fontSize: font.size.sm, lineHeight: 22, fontWeight: font.weight.bold },
  spacer: { height: space.xs },
});
