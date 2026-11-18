import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { debugZustand } from "devbridge/expo";

interface State {
  count: number;
  inc: () => void;
  user: { name: string; address: { city: string } };
  setCity: (city: string) => void;
}

const useStore = create<State>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
  user: { name: "Ada", address: { city: "São Paulo" } },
  setCity: (city: string) =>
    set((s) => ({ user: { ...s.user, address: { ...s.user.address, city } } })),
}));

debugZustand(useStore, "counter");

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
  const city = useStore((s) => s.user.address.city);
  const setCity = useStore((s) => s.setCity);

  return (
    <ScrollView contentContainerStyle={styles.c}>
      <Text style={styles.h1}>DevBridge Playground</Text>
      <Text style={styles.counter}>count: {count} · city: {city}</Text>
      <Btn label="increment" onPress={inc} />
      <Btn label="mudar cidade" onPress={() => setCity(city === "São Paulo" ? "Recife" : "São Paulo")} />
      <Btn label="console.log('olá', { a: 1 })" onPress={() => console.log("olá", { a: 1 })} />
      <Btn label="console.warn('atenção')" onPress={() => console.warn("atenção")} />
      <Btn label="console.error + objeto circular" onPress={() => {
        const a: any = { name: "x" }; a.self = a;
        console.error("falhou", a);
      }} />
      <Btn label="throw error" onPress={() => { throw new Error("crash de teste"); }} />
      <Btn label='fetch("https://jsonplaceholder.typicode.com/todos/1")'
        onPress={() => fetch("https://jsonplaceholder.typicode.com/todos/1").then(r => r.json()).then(console.log)} />
      <Btn label="POST httpbin" onPress={() => fetch("https://httpbin.org/post", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x: 1 }) })} />
      <Btn label="fetch 404" onPress={() => fetch("https://jsonplaceholder.typicode.com/nope")} />
      <Btn label='AsyncStorage.setItem("@user", json)'
        onPress={() => AsyncStorage.setItem("@user", JSON.stringify({ name: "DevBridge", tags: ["a", "b"] }))} />
      <Btn label='AsyncStorage.removeItem("@user")' onPress={() => AsyncStorage.removeItem("@user")} />
      <Btn label="AsyncStorage.multiSet" onPress={() => AsyncStorage.multiSet([["@a", "1"], ["@b", "2"]])} />
      <Btn label="AsyncStorage.clear" onPress={() => AsyncStorage.clear()} />
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
