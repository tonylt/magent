import { DarkTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AgentScreen } from "./src/screens/AgentScreen";
import { AttentionHomeScreen } from "./src/screens/AttentionHomeScreen";
import { ComposerScreen } from "./src/screens/ComposerScreen";
import { ConnectScreen } from "./src/screens/ConnectScreen";
import { PermissionScreen } from "./src/screens/PermissionScreen";
import { WorkspacesScreen } from "./src/screens/WorkspacesScreen";
import type { RootStackParamList } from "./src/navigation";
import { colors, font } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={theme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { color: colors.text, fontWeight: font.weight.bold },
            headerTintColor: colors.accent,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="Home" component={AttentionHomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Connect" component={ConnectScreen} options={{ title: "Connect", presentation: "modal" }} />
          <Stack.Screen name="Workspaces" component={WorkspacesScreen} options={{ title: "Workspaces" }} />
          <Stack.Screen name="Agent" component={AgentScreen} options={{ title: "Agent" }} />
          <Stack.Screen name="Composer" component={ComposerScreen} options={{ title: "Follow-up", presentation: "modal" }} />
          <Stack.Screen name="Permission" component={PermissionScreen} options={{ title: "Permission", presentation: "modal" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
