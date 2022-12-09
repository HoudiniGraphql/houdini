// vite.config.js
import { sveltekit } from "file:///home/jycouet/udev/gh/lib/houdini/node_modules/.pnpm/@sveltejs+kit@1.0.0-next.577_svelte@3.52.0+vite@3.2.4/node_modules/@sveltejs/kit/src/exports/vite/index.js";
import houdini from "file:///home/jycouet/udev/gh/lib/houdini/packages/houdini/build/vite-esm/index.js";
import { libReporter } from "file:///home/jycouet/udev/gh/lib/houdini/node_modules/.pnpm/vite-plugin-lib-reporter@0.0.6/node_modules/vite-plugin-lib-reporter/index.js";
var config = {
  plugins: [
    houdini(),
    sveltekit(),
    libReporter([
      {
        name: "houdini",
        includes: ["$houdini/runtime", "houdini.config.js"],
        excludes: ["vite/preload-helper"]
      },
      {
        name: "houdini-svelte",
        includes: ["$houdini/plugins/houdini-svelte/runtime", "src/client.ts"],
        excludes: ["vite/preload-helper", "$houdini/runtime", "$houdini/index.js", "svelte"]
      },
      {
        name: "houdini-full-e2e",
        includes: ["$houdini", "src/client.ts", "houdini.config.js"],
        excludes: ["vite/preload-helper", "svelte"]
      }
    ])
  ]
};
var vite_config_default = config;
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9qeWNvdWV0L3VkZXYvZ2gvbGliL2hvdWRpbmkvZTJlL3N2ZWx0ZWtpdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvanljb3VldC91ZGV2L2doL2xpYi9ob3VkaW5pL2UyZS9zdmVsdGVraXQvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvanljb3VldC91ZGV2L2doL2xpYi9ob3VkaW5pL2UyZS9zdmVsdGVraXQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBzdmVsdGVraXQgfSBmcm9tICdAc3ZlbHRlanMva2l0L3ZpdGUnO1xuaW1wb3J0IGhvdWRpbmkgZnJvbSAnaG91ZGluaS92aXRlJztcbmltcG9ydCB7IGxpYlJlcG9ydGVyIH0gZnJvbSAndml0ZS1wbHVnaW4tbGliLXJlcG9ydGVyJztcblxuLyoqIEB0eXBlIHtpbXBvcnQoJ3ZpdGUnKS5Vc2VyQ29uZmlnfSAqL1xuY29uc3QgY29uZmlnID0ge1xuICBwbHVnaW5zOiBbXG4gICAgaG91ZGluaSgpLFxuICAgIHN2ZWx0ZWtpdCgpLFxuXG4gICAgLy8gVGhpcyBwbHVnaW4gaXMgY2hlY2tpbmcgYnVpbGQgc2l6ZXMgYnkgbGliLlxuICAgIC8vIEl0J3Mgbm90IHJlcXVpcmVkIGZvciBIb3VkaW5pIHRvIHdvcmsuXG4gICAgbGliUmVwb3J0ZXIoW1xuICAgICAge1xuICAgICAgICBuYW1lOiAnaG91ZGluaScsXG4gICAgICAgIGluY2x1ZGVzOiBbJyRob3VkaW5pL3J1bnRpbWUnLCAnaG91ZGluaS5jb25maWcuanMnXSxcbiAgICAgICAgZXhjbHVkZXM6IFsndml0ZS9wcmVsb2FkLWhlbHBlciddXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnaG91ZGluaS1zdmVsdGUnLFxuICAgICAgICBpbmNsdWRlczogWyckaG91ZGluaS9wbHVnaW5zL2hvdWRpbmktc3ZlbHRlL3J1bnRpbWUnLCAnc3JjL2NsaWVudC50cyddLFxuICAgICAgICBleGNsdWRlczogWyd2aXRlL3ByZWxvYWQtaGVscGVyJywgJyRob3VkaW5pL3J1bnRpbWUnLCAnJGhvdWRpbmkvaW5kZXguanMnLCAnc3ZlbHRlJ11cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdob3VkaW5pLWZ1bGwtZTJlJyxcbiAgICAgICAgaW5jbHVkZXM6IFsnJGhvdWRpbmknLCAnc3JjL2NsaWVudC50cycsICdob3VkaW5pLmNvbmZpZy5qcyddLFxuICAgICAgICBleGNsdWRlczogWyd2aXRlL3ByZWxvYWQtaGVscGVyJywgJ3N2ZWx0ZSddXG4gICAgICB9XG4gICAgXSlcbiAgXVxufTtcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUErVCxTQUFTLGlCQUFpQjtBQUN6VixPQUFPLGFBQWE7QUFDcEIsU0FBUyxtQkFBbUI7QUFHNUIsSUFBTSxTQUFTO0FBQUEsRUFDYixTQUFTO0FBQUEsSUFDUCxRQUFRO0FBQUEsSUFDUixVQUFVO0FBQUEsSUFJVixZQUFZO0FBQUEsTUFDVjtBQUFBLFFBQ0UsTUFBTTtBQUFBLFFBQ04sVUFBVSxDQUFDLG9CQUFvQixtQkFBbUI7QUFBQSxRQUNsRCxVQUFVLENBQUMscUJBQXFCO0FBQUEsTUFDbEM7QUFBQSxNQUNBO0FBQUEsUUFDRSxNQUFNO0FBQUEsUUFDTixVQUFVLENBQUMsMkNBQTJDLGVBQWU7QUFBQSxRQUNyRSxVQUFVLENBQUMsdUJBQXVCLG9CQUFvQixxQkFBcUIsUUFBUTtBQUFBLE1BQ3JGO0FBQUEsTUFDQTtBQUFBLFFBQ0UsTUFBTTtBQUFBLFFBQ04sVUFBVSxDQUFDLFlBQVksaUJBQWlCLG1CQUFtQjtBQUFBLFFBQzNELFVBQVUsQ0FBQyx1QkFBdUIsUUFBUTtBQUFBLE1BQzVDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBRUEsSUFBTyxzQkFBUTsiLAogICJuYW1lcyI6IFtdCn0K
