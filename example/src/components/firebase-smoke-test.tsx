import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fs, firebaseProjectId } from '@/lib/firebase';

const SMOKE_COLLECTION = 'smoke-tests';

type Result = { ok: boolean; message: string };

/**
 * Smoke test do Firebase: grava um documento no Firestore e lê os últimos 3.
 * Serve para confirmar que os arquivos de config (google-services.json /
 * GoogleService-Info.plist) foram mesmo embutidos no build nativo.
 */
export function FirebaseSmokeTest() {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = useCallback(async (task: () => Promise<string>) => {
    setBusy(true);
    setResult(null);
    try {
      setResult({ ok: true, message: await task() });
    } catch (error) {
      setResult({ ok: false, message: String((error as Error).message ?? error) });
    } finally {
      setBusy(false);
    }
  }, []);

  const writeTestDoc = useCallback(() => {
    void run(async () => {
      const db = fs.getFirestore();
      const ref = await fs.addDoc(fs.collection(db, SMOKE_COLLECTION), {
        message: `smoke test do ${Platform.OS}`,
        platform: Platform.OS,
        createdAt: fs.serverTimestamp(),
      });
      return `gravou "${ref.id}" na coleção ${SMOKE_COLLECTION}`;
    });
  }, [run]);

  const readLatest = useCallback(() => {
    void run(async () => {
      const db = fs.getFirestore();
      const snapshot = await fs.getDocs(
        fs.query(fs.collection(db, SMOKE_COLLECTION), fs.orderBy('createdAt', 'desc'), fs.limit(3)),
      );
      if (snapshot.empty) {
        return 'coleção vazia — grave um documento primeiro';
      }
      const messages = snapshot.docs.map((doc) => doc.data().message).join(' | ');
      return `leu ${snapshot.size} doc(s): ${messages}`;
    });
  }, [run]);

  const projectId = firebaseProjectId();

  return (
    <ThemedView type="backgroundSelected" style={styles.box}>
      <ThemedText type="small">
        projectId:{' '}
        <ThemedText type="code">{projectId ?? 'não configurado'}</ThemedText>
      </ThemedText>

      {projectId === null && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Firebase nativo não configurado neste build — solte os arquivos de config em{' '}
          <ThemedText type="code">example/</ThemedText> e refaça o dev build (veja{' '}
          <ThemedText type="code">FIREBASE.md</ThemedText>).
        </ThemedText>
      )}

      <ThemedView style={styles.buttonsRow}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={writeTestDoc}
          disabled={busy}>
          <ThemedView type="backgroundElement" style={styles.buttonInner}>
            <ThemedText type="smallBold">Gravar doc</ThemedText>
          </ThemedView>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={readLatest}
          disabled={busy}>
          <ThemedView type="backgroundElement" style={styles.buttonInner}>
            <ThemedText type="smallBold">Ler últimos 3</ThemedText>
          </ThemedView>
        </Pressable>
        {busy && <ActivityIndicator color={theme.text} style={styles.spinner} />}
      </ThemedView>

      {result && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.status}
          numberOfLines={4}>
          {result.ok ? '✔ ' : '✖ '}
          {result.message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  hint: {
    lineHeight: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  button: {
    opacity: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonInner: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  spinner: {
    marginLeft: Spacing.one,
  },
  status: {
    lineHeight: 20,
  },
});
