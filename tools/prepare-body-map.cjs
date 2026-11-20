const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve(process.argv[2]);
const assets = path.resolve(__dirname, "../app/src/main/assets");
const { frontMuscles, backMuscles } = JSON.parse(
  fs.readFileSync(path.join(source, "dist/data/body-muscles-data.json"), "utf8")
);
const regions = [frontMuscles, backMuscles].map(view => view.map(({ id, path }) => [id, path]));
fs.writeFileSync(path.join(assets, "body-map-data.js"),
  "// @emmorts/body-muscles 2.1.1 geometry (Apache-2.0). See LICENSE-body-muscles and NOTICE-body-muscles.\n" +
  "window.BODY_MAP_VIEWS = " + JSON.stringify(regions) + ";\n");
for (const file of ["LICENSE", "NOTICE"]) {
  fs.copyFileSync(path.join(source, file), path.join(assets, file + "-body-muscles.txt"));
}
