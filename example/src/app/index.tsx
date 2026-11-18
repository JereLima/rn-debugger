import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { create } from "zustand";

const useStore = create<{ count: number; inc: () => void }>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.btn} onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const count = useStore((s) => s.count);
  const inc = useStore((s) => s.inc);

  return (
    <ScrollView contentContainerStyle={styles.c}>
      <Text style={styles.h1}>DevBridge Playground</Text>
      <Text style={styles.counter}>count: {count}</Text>
      <Btn label="increment" onPress={inc} />
      <Btn label="console.log('olá', { a: 1 })" onPress={() => console.log("olá", { a: 1 })} />
      <Btn label="console.warn('atenção')" onPress={() => console.warn("atenção")} />
      <Btn label="console.error + objeto circular" onPress={() => {
        const a: any = { name: "x" }; a.self = a;
        console.error("falhou", a);
      }} />
      <Btn label="throw error" onPress={() => { throw new Error("crash de teste"); }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  c: { padding: 40 },
  h1: { fontSize: 22, fontWeight: "bold" },
  counter: { fontSize: 16, marginTop: 8 },
  btn: { backgroundColor: "#eee", padding: 12, borderRadius: 8, marginTop: 8 },
  btnText: { fontSize: 14 },
});
