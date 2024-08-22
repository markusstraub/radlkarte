import {defineConfig} from 'vite'
import replaceGeoJsonInHtml from './vite-plugin-replace-geojson-in-html'

export default defineConfig({
  root: 'src',
  assetsInclude: ['**/*.geojson'],
  build: {
    outDir: '../dist',
    assetsDir: 'assets',
  },
  plugins: [replaceGeoJsonInHtml()],

})
