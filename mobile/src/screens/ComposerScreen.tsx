import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Draft } from "../domain/types";
import { draftMatchesTarget } from "../domain/selectors";
import { getRepository } from "../data/instance";
import { redactSecrets } from "../data/paseo/daemon";
import { colors, font, radius, space, touchTarget } from "../theme";
import type { ScreenProps } from "../navigation";

// Route A: a real multiline input. On iOS the keyboard's microphone key provides
// native dictation (SFSpeechRecognizer under the hood) with no extra native module,
// so this works in Expo Go. A dedicated hold-to-talk recognizer (route B) needs a
// development build and is tracked as a long-term plan in the PRD.
export function ComposerScreen({ route, navigation }: ScreenProps<"Composer">) {
  const { agentId } = route.params;
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>({ agentId, text: "" });
  const [sending, setSending] = useState(false);

  const canSend = draftMatchesTarget(draft, agentId) && draft.text.trim().length > 0 && !sending;

  function confirmSend() {
    // Never auto-sends — explicit review + confirmation.
    Alert.alert("Send Follow-up?", draft.text.trim(), [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: () => void doSend() },
    ]);
  }

  async function doSend() {
    setSending(true);
    try {
      await getRepository().sendFollowup(agentId, draft.text.trim());
      navigation.goBack();
    } catch (e) {
      setSending(false);
      Alert.alert("Send failed", redactSecrets(e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.eyebrow}>FOLLOW-UP · REVIEW BEFORE SEND</Text>
        <Text style={styles.hint}>Type, or tap the microphone on the keyboard to dictate. Nothing sends automatically.</Text>
        <TextInput
          style={styles.input}
          value={draft.text}
          onChangeText={(text) => setDraft({ agentId, text })}
          placeholder="Write a follow-up…"
          placeholderTextColor={colors.textFaint}
          multiline
          autoFocus
          textAlignVertical="top"
          keyboardAppearance="dark"
          editable={!sending}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.actions}>
          <Pressable style={styles.cancel} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>
          <Pressable
            disabled={!canSend}
            style={[styles.send, !canSend && styles.sendDisabled]}
            onPress={confirmSend}
          >
            <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>{sending ? "SENDING…" : "SEND"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: space.lg, gap: space.sm },
  eyebrow: { color: colors.textFaint, fontSize: font.size.xs, letterSpacing: 2, fontWeight: font.weight.bold },
  hint: { color: colors.textDim, fontSize: font.size.sm, lineHeight: 20 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    color: colors.text,
    fontSize: font.size.lg,
    lineHeight: 26,
  },
  footer: { padding: space.lg, gap: space.md, borderTopWidth: 1, borderTopColor: colors.border },
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
    flex: 2,
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
