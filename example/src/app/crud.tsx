import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fs, firebaseProjectId } from '@/lib/firebase';

const TASKS = 'tasks';

type Task = { id: string; text: string; done: boolean };

/**
 * CRUD básico no Firestore pra testar o banco de ponta a ponta:
 * Create (addDoc) · Read (onSnapshot ao vivo) · Update (updateDoc) · Delete (deleteDoc).
 * A lista atualiza em tempo real — dá pra abrir o console do Firebase do lado
 * e ver os documentos mudando junto.
 */
export default function CrudScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const projectId = firebaseProjectId();
  // "carregando" apenas quando há algo pra assinar — evita setState no corpo do effect
  const [loading, setLoading] = useState(
    () => Platform.OS !== 'web' && firebaseProjectId() !== null,
  );

  // Read — live
  useEffect(() => {
    if (Platform.OS === 'web' || projectId === null) return;
    const db = fs.getFirestore();
    const q = fs.query(fs.collection(db, TASKS), fs.orderBy('createdAt', 'desc'));
    const unsubscribe = fs.onSnapshot(
      q,
      (snapshot) => {
        setTasks(snapshot.docs.map((d) => ({ ...(d.data() as Task), id: d.id })));
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [projectId]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setError(null);
    } catch (fnError) {
      setError(String((fnError as Error).message ?? fnError));
    }
  }, []);

  // Create
  const addTask = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    void run(() =>
      fs.addDoc(fs.collection(fs.getFirestore(), TASKS), {
        text: trimmed,
        done: false,
        createdAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp(),
      }),
    );
  }, [run, text]);

  // Update
  const toggleTask = useCallback(
    (task: Task) => {
      void run(() =>
        fs.updateDoc(fs.doc(fs.getFirestore(), TASKS, task.id), {
          done: !task.done,
          updatedAt: fs.serverTimestamp(),
        }),
      );
    },
    [run],
  );

  // Delete
  const removeTask = useCallback(
    (task: Task) => {
      void run(() => fs.deleteDoc(fs.doc(fs.getFirestore(), TASKS, task.id)));
    },
    [run],
  );

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">CRUD (Firestore)</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Na web o React Native Firebase cai para o firebase-js-sdk e precisa de{' '}
          initializeApp() com a config de um web app. Use a aba no iOS/Android —
          veja FIREBASE.md.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle">CRUD (Firestore)</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        projectId: <ThemedText type="code">{projectId ?? 'não configurado'}</ThemedText>
      </ThemedText>

      {projectId === null ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Firebase nativo não configurado neste build — solte os arquivos de config em{' '}
          <ThemedText type="code">example/</ThemedText> e refaça o dev build (FIREBASE.md).
        </ThemedText>
      ) : (
        <>
          <ThemedView style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={addTask}
              placeholder="Nova tarefa…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              onPress={addTask}>
              <ThemedView type="backgroundElement" style={styles.addButtonInner}>
                <ThemedText type="smallBold">Adicionar</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>

          {error && (
            <ThemedView type="backgroundSelected" style={styles.errorBox}>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={4}>
                ✖ {error}
              </ThemedText>
            </ThemedView>
          )}

          {loading ? (
            <ActivityIndicator color={theme.text} style={styles.spinner} />
          ) : tasks.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {error ? '' : 'Nenhuma tarefa — adicione a primeira acima.'}
            </ThemedText>
          ) : (
            tasks.map((task) => (
              <Pressable
                key={task.id}
                style={({ pressed }) => [styles.taskRow, pressed && styles.pressed]}
                onPress={() => toggleTask(task)}>
                <ThemedView type="backgroundElement" style={styles.taskInner}>
                  <SymbolView
                    name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'link' }}
                    size={20}
                    tintColor={task.done ? theme.text : theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    themeColor={task.done ? 'textSecondary' : 'text'}
                    style={[styles.taskText, task.done && styles.taskDone]}>
                    {task.text}
                  </ThemedText>
                  <Pressable
                    hitSlop={12}
                    style={({ pressed }) => pressed && styles.pressed}
                    onPress={() => removeTask(task)}>
                    <SymbolView
                      name={{ ios: 'trash', android: 'delete', web: 'link' }}
                      size={18}
                      tintColor={theme.textSecondary}
                    />
                  </Pressable>
                </ThemedView>
              </Pressable>
            ))
          )}

          {!loading && tasks.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
              {tasks.filter((t) => t.done).length}/{tasks.length} concluídas · toque na tarefa pra
              alternar, na lixeira pra deletar
            </ThemedText>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
    gap: Spacing.three,
  },
  hint: {
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  addButton: {
    opacity: 1,
  },
  addButtonInner: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  errorBox: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  spinner: {
    marginTop: Spacing.three,
  },
  taskRow: {
    opacity: 1,
  },
  taskInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  taskText: {
    flex: 1,
  },
  taskDone: {
    textDecorationLine: 'line-through',
  },
  footer: {
    textAlign: 'center',
  },
});
