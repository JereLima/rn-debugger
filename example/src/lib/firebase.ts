/**
 * Firebase do app de exemplo (React Native Firebase v27).
 *
 * Funciona no esquema "solta os arquivos e pronto": no nativo, a configuração
 * vem dos arquivos que você joga na raiz de `example/`:
 *   - google-services.json      (Android)
 *   - GoogleService-Info.plist (iOS)
 *
 * O config plugin `@react-native-firebase/app` copia esses arquivos para os
 * projetos nativos durante o prebuild (os caminhos estão em `app.json`, nos
 * campos `ios.googleServicesFile` e `android.googleServicesFile`).
 *
 * NÃO chame initializeApp() no iOS/Android — o SDK nativo se configura sozinho
 * a partir desses arquivos. No web o React Native Firebase cai para o
 * firebase-js-sdk, que exige initializeApp() com a config de um *web app* do
 * seu projeto (veja FIREBASE.md).
 *
 * Use SEMPRE `fs.*` (fs.addDoc, fs.onSnapshot, ...) — nunca importe direto de
 * `@react-native-firebase/firestore` nas telas. `fs` é uma fachada MUTÁVEL:
 * os exports do módulo RNFB v27 são getters sem setter, então o
 * `debugFirestore()` do rn-debugger não consegue substituir as funções lá —
 * neste objeto plain o monkey-patch funciona e as ops aparecem no debugger.
 */
import { getApp } from '@react-native-firebase/app';
import * as RNFBFirestore from '@react-native-firebase/firestore';

/** Fachada mutável com a API modular inteira (getFirestore, addDoc, onSnapshot, ...). */
export const fs: typeof RNFBFirestore = { ...RNFBFirestore };

/**
 * Project ID que o app nativo leu dos arquivos de config.
 * Retorna null se o Firebase nativo não foi configurado — por exemplo, quando
 * o dev build foi compilado sem os arquivos (rebuild necessário) ou na web
 * sem initializeApp().
 */
export function firebaseProjectId(): string | null {
  try {
    return getApp().options.projectId ?? null;
  } catch {
    return null;
  }
}
