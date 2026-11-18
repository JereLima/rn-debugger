// O SDK (devbridge, symlink para ../sdk) importa peers nativos
// (react-native, expo-constants) que só existem no node_modules do example.
// Sem este mapeamento o Metro tenta resolver a partir de sdk/dist e falha.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "react-native": path.resolve(__dirname, "node_modules/react-native"),
  "expo-constants": path.resolve(__dirname, "node_modules/expo-constants"),
  "react-devtools-core": path.resolve(__dirname, "node_modules/react-devtools-core"),
};

module.exports = config;
