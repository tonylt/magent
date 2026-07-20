import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { connectWithOffer, useMockData } from "../data/instance";
import { colors, font, radius, space, touchTarget } from "../theme";
import type { ScreenProps } from "../navigation";

export function ConnectScreen({ navigation }: ScreenProps<"Connect">) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      await connectWithOffer(url.trim());
      navigation.navigate("Home");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>CONNECT TO A PASEO HOST</Text>
        <Text style={styles.help}>
          Paste the pairing offer URL from Paseo (looks like https://…/#offer=…). The connection is
          end-to-end encrypted over the relay.
        </Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://app.paseo.sh/#offer=…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          editable={!busy}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={busy || url.trim().length === 0}
          style={[styles.connect, (busy || url.trim().length === 0) && styles.disabled]}
          onPress={connect}
        >
          <Text style={styles.connectText}>{busy ? "CONNECTING…" : "CONNECT"}</Text>
        </Pressable>
        <Pressable
          style={styles.mock}
          onPress={() => {
            useMockData();
            navigation.navigate("Home");
          }}
        >
          <Text style={styles.mockText}>USE DEMO DATA</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  eyebrow: { color: colors.textFaint, fontSize: font.size.xs, letterSpacing: 2, fontWeight: font.weight.bold },
  help: { color: colors.textDim, fontSize: font.size.sm, lineHeight: 20 },
  input: {
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    color: colors.text,
    fontSize: font.size.sm,
    textAlignVertical: "top",
  },
  error: { color: colors.error, fontSize: font.size.sm },
  footer: { padding: space.lg, gap: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  connect: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  connectText: { color: colors.bg, fontSize: font.size.md, fontWeight: font.weight.bold, letterSpacing: 1 },
  mock: { minHeight: touchTarget, alignItems: "center", justifyContent: "center" },
  mockText: { color: colors.textDim, fontSize: font.size.sm, fontWeight: font.weight.bold, letterSpacing: 1 },
});
