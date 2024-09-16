const replaceGeoJsonInHtmlPlugin = () => {
  return {
    name: 'replace-geojson-in-html',
    transformIndexHtml(html, ctx) {

      if (!ctx.bundle) {
        return html;
      }

      const geojsonRegEx = /radlkarte-.*\.geojson/;

      for (const asset of Object.values(ctx.bundle)) {
        if (geojsonRegEx.test(asset.name)) {
          html = html.replace('data/' + asset.name, asset.fileName);
        }
      }

      return html;
    },
  }
}

export default replaceGeoJsonInHtmlPlugin;
