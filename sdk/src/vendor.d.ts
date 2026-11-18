// expo-constants é peerDependency opcional: presente só em apps Expo.
// Declaração ambiente para o build de tipos (dts) sem instalá-lo.
declare module "expo-constants" {
  const Constants: any;
  export default Constants;
}

// react-devtools-core só existe no runtime RN (dependência do react-native).
// O SDK carrega via require() dinâmico; Metro resolve no contexto do app host.
declare module "react-devtools-core" {
  const core: any;
  export = core;
}

// Metro/RN sempre fornece require global; tsup o mantém como chamada externa.
declare const require: any;
