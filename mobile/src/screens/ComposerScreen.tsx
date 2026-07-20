import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Draft } from "../domain/types";
import { draftMatchesTarget } from "../domain/selectors";
import { colors, font, radius, space, touchTarget } from "../theme";
import type { ScreenProps } from "../navigation";

// Mock dictation phrases appended on each hold-release, standing in for native STT
// until M2-S05 wires real speech-to-text.
const MOCK_PHRASES = [
  "Approve the write and continue.",
  "Add a test for the refresh race first.",
  "Explain why the turn failed before retrying.",
];

export function ComposerScreen({ route, navigation }: ScreenProps<"Composer">) {
  const { agentId } = route.params;
  const [draft, setDraft] = useState<Draft>({ agentId, text: "" });
  const [recording, setRecording] = useState(false);
  const [dictations, setDictations] = useState(0);

  function appendDictation() {
    const phrase = MOCK_PHRASES[dictations % MOCK_PHRASES.length];
    setDictations((n) => n + 1);
    setDraft((current) => ({
      agentId,
      text: current.text ? `${current.text} ${phrase}` : phrase,
    }));
  }

  const canSend = draftMatchesTarget(draft, agentId) && draft.text.trim().length > 0;

  function send() {
    // Never auto-sends; explicit confirmation, then clear and return. No real submit
    // until the daemon is wired (M2-S05).
    Alert.alert("Send Follow-up?", draft.text, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: () => navigation.goBack(),
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>FOLLOW-UP · REVIEW BEFORE SEND</Text>
        <View style={styles.draftBox}>
          <Text style={draft.text ? styles.draftText : styles.placeholder}>
            {draft.text || "Hold the button to dictate. Nothing sends automatically."}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPressIn={() => setRecording(true)}
          onPressOut={() => {
            setRecording(false);
            appendDictation();
          }}
          style={({ pressed }) => [styles.dictate, (recording || pressed) && styles.dictateActive]}
        >
          <Text style={styles.dictateText}>{recording ? "LISTENING… RELEASE TO ADD" : "HOLD TO DICTATE"}</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable style={styles.cancel} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>
          <Pressable
            disabled={!canSend}
            style={[styles.send, !canSend && styles.sendDisabled]}
            onPress={send}
          >
            <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>SEND</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  eyebrow: { color: colors.textFaint, fontSize: font.size.xs, letterSpacing: 2, fontWeight: font.weight.bold },
  draftBox: {
    minHeight: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  draftText: { color: colors.text, fontSize: font.size.lg, lineHeight: 26 },
  placeholder: { color: colors.textFaint, fontSize: font.size.md, lineHeight: 24 },
  footer: { padding: space.lg, gap: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  dictate: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  dictateActive: { backgroundColor: colors.accent },
  dictateText: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold, letterSpacing: 1 },
  actions: { flexDirection: "row", gap: space.md },
  cancel: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: colors.textDim, fontSize: font.size.md, fontWeight: font.weight.bold, letterSpacing: 1 },
  send: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sendText: { color: colors.bg, fontSize: font.size.md, fontWeight: font.weight.bold, letterSpacing: 1 },
  sendTextDisabled: { color: colors.textFaint },
});
