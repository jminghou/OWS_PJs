// Monorepo 版 Metro 設定：讓 App 看得到 packages/ 的原始碼（@ows/ziwei-engine、@ows/ziwei-chart）。
// 兩個套件都以 .ts 原始碼當入口（package.json main 指向 src/index.ts），不需要先 build。
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. 監看整個 monorepo，packages/ 改了會熱更新
config.watchFolders = [monorepoRoot];

// 2. 先找 App 自己的 node_modules（React 19 / RN 在這裡），再找根目錄的（lunar-typescript、js-sha256 提升在根）
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. 保留階層查找：npm 會把版本衝突的套件巢狀安裝（例如 expo/node_modules/expo-asset），
//    關掉階層查找會找不到它們。React 18/19 撞版的問題改由第 4 點的別名解決。

// 4. React 只能有一份：packages 內若有人 import react，一律解析到 App 這份（不會抓到網站的 React 18）
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

module.exports = config;
