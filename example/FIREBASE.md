# Firebase no app de exemplo

O setup já está pronto: dependências instaladas, config plugin configurado e
wrapper em `src/lib/firebase.ts`. O fluxo é **"solta os arquivos na pasta e
tudo funciona"** — você só precisa gerar os 2 arquivos de config do SEU projeto
Firebase e jogar na raiz de `example/`.

> Sim, você precisa criar o projeto no console antes — é grátis. O console é
> quem gera os arquivos com os IDs/API key do seu projeto; não dá pra inventar
> esses valores.

## O que já está pronto no repo

| Peça | Onde |
| --- | --- |
| `@react-native-firebase/app` + `firestore` (v27) | `package.json` |
| Config plugin + `useFrameworks: "dynamic"` (SPM) | `app.json` → `plugins` |
| Caminhos dos arquivos de config | `app.json` → `ios.googleServicesFile` / `android.googleServicesFile` |
| Package/bundle ID esperado | `com.jerelima.example` (Android e iOS) |
| Wrapper + API modular reexportada | `src/lib/firebase.ts` |
| Smoke test (gravar/ler doc no Firestore) | aba **Explore** → "Firebase (Firestore)" |
| CRUD completo (criar/ler/toggle/deletar tarefas, ao vivo) | aba **CRUD** — coleção `tasks` |

## Passo a passo (uma vez só)

1. **Crie o projeto** em <https://console.firebase.google.com> (plano Spark, grátis).

2. **Adicione um app Android** (ícone Android no painel "Your apps"):
   - *Android package name*: `com.jerelima.example` (tem que bater exatamente)
   - Apelido: o que quiser. SHA-1 não é preciso pra Firestore.
   - Baixe o `google-services.json` e **solte em `example/`**.

3. **Adicione um app iOS** (ícone iOS):
   - *iOS bundle ID*: `com.jerelima.example`
   - Baixe o `GoogleService-Info.plist` e **solte em `example/`**.

4. **Crie o banco Firestore**: Console → Firestore Database → Create database
   → comece em **modo teste** (as regras padrão bloqueiam e o smoke test
   falha com `PERMISSION_DENIED` se criar em modo locked). Sugestão de regra
   de teste (expira em 30 dias — troque antes de publicar qualquer coisa):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

5. **Refaça o dev build** (o app instalado não tem os módulos nativos do
   Firebase — desinstale ele do device/simulador antes):

   ```bash
   cd example
   npx expo prebuild --clean
   npx expo run:ios      # ou: npx expo run:android
   ```

   > Se rodar sem os arquivos de config, o prebuild falha com um erro explícito
   > tipo *"GoogleService-Info.plist doesn't exist in ./GoogleService-Info.plist"* —
   > é o plugin avisando que falta soltar o arquivo.

6. **Teste**: abra a aba **CRUD** e brinque — adicione tarefas, toque pra
   alternar o done, delete com a lixeira. A lista é ao vivo (`onSnapshot`):
   deixe o console do Firebase aberto do lado e veja os docs mudando juntos.
   O smoke test na aba **Explore** também mostra o `projectId` + gravação/leitura.

## Requisitos

- Xcode ≥ 26.2 (Firebase Apple SDK 13 é SPM-only no RNFirebase v27)
- Node ≥ 22.13 (a stack do Expo 58 rejeita Node 20)

## Web

O React Native Firebase cai para o `firebase-js-sdk` na web, que precisa de
`initializeApp()` com a config de um **web app** (ícone `</>` no console). O
smoke test fica oculto na web de propósito — se quiser usar, adicione a config
do web app em `src/lib/firebase.ts` seguindo
<https://rnfirebase.io/#other--web>.

## Adicionar outros serviços depois

```bash
npx expo install @react-native-firebase/auth   # exemplo
```

Se o módulo tiver `app.plugin.js` (crashlytics, analytics...), adicione-o ao
array `plugins` do `app.json` e rode `npx expo prebuild --clean` de novo.

## Sobre os arquivos ficarem fora do git

`google-services.json` e `GoogleService-Info.plist` estão no `.gitignore`: não
são segredos, mas amarrariam o repo ao seu projeto pessoal. Cada pessoa que
clonar cria os seus e solta na pasta — mesmo esquema que você.
