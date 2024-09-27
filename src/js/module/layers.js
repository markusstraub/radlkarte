import carto from "./layers/carto";
import getRadlkarteLayersFor from "./layers/radlkarte.js";

const layers = [
  ...carto,
  ...getRadlkarteLayersFor("klagenfurt"),
  ...getRadlkarteLayersFor("linz"),
  ...getRadlkarteLayersFor("rheintal"),
  ...getRadlkarteLayersFor("schwarzatal"),
  ...getRadlkarteLayersFor("steyr"),
  ...getRadlkarteLayersFor("wien"),
];

export default layers;
