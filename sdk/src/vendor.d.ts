// expo-constants é peerDependency opcional: presente só em apps Expo.
// Declaração ambiente para o build de tipos (dts) sem instalá-lo.
declare module "expo-constants" {
  const Constants: any;
  export default Constants;
}
