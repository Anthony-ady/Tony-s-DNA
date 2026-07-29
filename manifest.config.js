import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "AYL APP",
  version: "1.0.12",
  description: "ADY platform administration",
  action: {
    default_title: "Open AYL APP",
    default_icon: {
      16: "public/favicon-16x16.png",
      48: "public/favicon-96x96.png",
      128: "public/favicon-128.png",
    },
  },
  options_ui: {
    page: "index.html",
    open_in_tab: true,
  },
  background: {
    service_worker: "src/extension/background.js",
    type: "module",
  },
  icons: {
    16: "public/favicon-16x16.png",
    48: "public/favicon-96x96.png",
    128: "public/favicon-128.png",
  },
  permissions: ["storage", "tabs"],
  host_permissions: ["https://back.platform.gcp.omnitagjs.com/*"],
});
