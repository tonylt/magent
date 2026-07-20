import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Home: undefined;
  Workspaces: undefined;
  Agent: { agentId: string };
  Composer: { agentId: string };
  Permission: { permissionId: string };
};

export type ScreenProps<Route extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Route>;
