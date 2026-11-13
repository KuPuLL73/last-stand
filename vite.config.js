import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({base:'./',assetsInclude:['**/*.glb','**/*.blend'],server:{watch:{ignored:['**/game/tests/**','**/game/artifacts/**','**/design/**']}},build:{rollupOptions:{input:{studio:resolve(import.meta.dirname,'index.html'),play:resolve(import.meta.dirname,'play.html'),survival:resolve(import.meta.dirname,'survival.html')}}}});
