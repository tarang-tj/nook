// Vite config for the local HTTPS development server.
// Used only by "npm run dev:https". The main "npm run dev" does not use this.
//
// Why HTTPS? WebXR immersive-ar requires a secure context. A plain
// http://192.168.x.x address cannot start an AR session. Running
//   npm run dev:https
// prints a Network address such as https://192.168.x.x:5174/. Open that on
// the phone. The phone will show a certificate warning because the cert is
// self-signed; tap "Advanced" → "Proceed" (or equivalent) to accept it.
// This is safe on a private Wi-Fi network with no outside traffic.
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [basicSsl()],
  server: { host: true },
});
