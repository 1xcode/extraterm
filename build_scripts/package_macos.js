
/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const sh = require('shelljs');
const fs = require('fs');
const path = require('path');
const command = require('commander');

sh.config.fatal = true;

const packaging_functions = require('./packaging_functions');

async function main() {
  const parsedArgs = new command.Command("extraterm");
  parsedArgs.option('--version [app version]', 'Application version to use', null)
    .parse(process.argv);

  if ( ! test('-f', './package.json')) {
    echo("This script was called from the wrong directory.");
    return;
  }
  const SRC_DIR = "" + pwd();
  const BUILD_TMP_DIR = path.join(SRC_DIR, 'build_tmp');
  if (test('-d', BUILD_TMP_DIR)) {
    rm('-rf', BUILD_TMP_DIR);
  }
  mkdir(BUILD_TMP_DIR);

  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);

  const electronVersion = packageData.devDependencies['electron'];

  let version = parsedArgs.version == null ? packageData.version : parsedArgs.version;
  if (version[0] === "v") {
    version = version.slice(1);
  }

  await packaging_functions.makePackage({
    arch: "x64",
    platform: "darwin",
    electronVersion,
    version,
    outputDir: BUILD_TMP_DIR,
    replaceModuleDirs: false
  });

  await packaging_functions.makeDmg({
      version,
      outputDir: BUILD_TMP_DIR,
      useDocker: false
  });

  echo("");
  echo("Done.");
}

function makeDmg( { version, outputDir, useDocker } ) {
  echo("");
  echo("---------------------------------------------------");
  echo("Building dmg file for macOS");
  echo("---------------------------------------------------");

  const BUILD_TMP_DIR = outputDir;
  const SRC_DIR = "" + pwd();

  const darwinPath = path.join(BUILD_TMP_DIR, `extraterm-${version}-darwin-x64`);
  for (const f of ls(darwinPath)) {
    if ( ! f.endsWith(".app")) {
      echo(`Deleting ${f}`);
      rm(path.join(darwinPath, f));
    }
  }

  cp(path.join(SRC_DIR, "build_scripts/resources/macos/.DS_Store"), path.join(darwinPath, ".DS_Store"));
  cp(path.join(SRC_DIR, "build_scripts/resources/macos/.VolumeIcon.icns"), path.join(darwinPath, ".VolumeIcon.icns"));
  mkdir(path.join(darwinPath,".background"));
  cp(path.join(SRC_DIR, "build_scripts/resources/macos/.background/extraterm_background.png"), path.join(darwinPath, ".background/extraterm_background.png"));

  ln("-s", "/Applications", path.join(darwinPath, "Applications"));

  if (useDocker) {
    exec(`docker run --rm -v "${BUILD_TMP_DIR}:/files" sporsh/create-dmg Extraterm /files/extraterm-${version}-darwin-x64/ /files/extraterm_${version}.dmg`);
  } else {
    exec(`hdiutil create -volname Extraterm -srcfolder ${darwinPath} -ov -format UDZO ${BUILD_TMP_DIR}/extraterm_${version}.dmg`);
  }

  return true;
}

main().catch(ex => {
  console.log(ex);
  process.exit(1);
});
