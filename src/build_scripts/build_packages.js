/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fs = require('fs');
const path = require('path');
const packager = require('electron-packager');

const log = console.log.bind(console);
const BUILD_TMP = 'build_tmp';
const MODULE_VERSON = 50; // This version number also appears in thememanager.ts

function main() {
  "use strict";
  
  if ( ! test('-f', './package.json')) {
    echo("This script was called from the wrong directory.");
    return;
  }

  const srcRootDir = pwd();
  if (test('-d', BUILD_TMP)) {
    rm('-rf', BUILD_TMP);
  }
  mkdir(BUILD_TMP);
  
  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);
  
  const gitUrl = packageData.repository.url.replace("git://github.com/", "git@github.com:");
  
  echo("Fetching a clean copy of the source code from " + gitUrl);
  cd(BUILD_TMP);
  const buildTmpPath = pwd();
  
  exec("git clone --depth 1 " + gitUrl);
  
  echo("Setting up the run time dependencies in " + BUILD_TMP);

  cd("extraterm");
  echo("Downloading dependencies.");
  exec("npm install");
  
  echo("Building");
  exec("npm run build");
  
  echo("Removing development dependencies");
  exec("npm prune --production");

  // Create the commands zip
  echo("Creating commands.zip");
  const commandsDir = packageData.name + "-commands-" + packageData.version;
  cp("-r", "src/commands", path.join(buildTmpPath, commandsDir));
  const codeDir = pwd();
  cd(buildTmpPath);
  exec(`zip -y -r ${commandsDir}.zip ${commandsDir}`);
  cd(codeDir);

  const electronVersion = packageData.devDependencies['electron'];

  const ignoreRegExp = [
    /^\/src\/build_scripts\//,
    /^\/test\//,
    /^\/build_tmp\//,
    /^\/src\/typedocs\//,
    /\.ts$/,
    /\.js\.map$/,
    /^\/\.git\//
  ];

  const ignoreFunc = function ignoreFunc(filePath) {
    const result = ignoreRegExp.some( (exp) => exp.test(filePath));
    return result;
  };
  
  function pruneNodeSass(versionedOutputDir, arch, platform) {
    const gutsDir = platform === "darwin" ? "extraterm.app/Contents/Resources/app" : "resources/app";
    const nodeSassVendorDir = path.join(versionedOutputDir, gutsDir, "node_modules/node-sass/vendor");

    rm('-rf', nodeSassVendorDir);
    
    const nodeSassBinaryDir = path.join(versionedOutputDir, gutsDir, "src/node-sass-binary");
    ["darwin-x64", "linux-ia32", "linux-x64", "win32-x64"].forEach( (name) => {
      if (name !== platform + "-" + arch) {
        rm('-rf', path.join(nodeSassBinaryDir, name + "-" + MODULE_VERSON));
      }
    });
  }

  function pruneEmojiOne(versionedOutputDir, platform) {
    if (platform !== "linux") {
      const gutsDir = platform === "darwin" ? "extraterm.app/Contents/Resources/app" : "resources/app";
      const emojiOnePath = path.join(versionedOutputDir, gutsDir, "src/themes/default/emojione-android.ttf");
      rm(emojiOnePath);
    }
  }

  function copyWindowsNodeSassBinary(versionedOutputDir, platform) {
    // See the start of thememanager.ts. Once we are past node v6.5, this code here can be removed.
    // See https://github.com/nodejs/node/issues/8444 This bug breaks the require() trick done in thememanager.ts.
    if (platform === "win32") {
      const gutsDir = "resources/app";
      const nodeSassVendorDir = path.join(versionedOutputDir, gutsDir, "node_modules/node-sass/vendor");
      const nodeSassBinary = path.join(versionedOutputDir, gutsDir, "src/node-sass-binary/win32-x64-" + MODULE_VERSON + "/binding.node");
      mkdir(nodeSassVendorDir);
      const nodeSassBinaryDir = path.join(nodeSassVendorDir, "win32-x64-" + MODULE_VERSON)
      mkdir(nodeSassBinaryDir);
      cp(nodeSassBinary, path.join(nodeSassBinaryDir, "binding.node"));
    }
  }

  function makePackage(arch, platform) {
    log("");
    return new Promise(function(resolve, reject) {
      
      // Clean up the output dirs and files first.
      const versionedOutputDir = packageData.name + "-" + packageData.version + "-" + platform + "-" + arch;
      if (test('-d', versionedOutputDir)) {
        rm('-rf', versionedOutputDir);
      }
      
      const outputZip = path.join(buildTmpPath, versionedOutputDir + ".zip");

      packager({
        arch: arch,
        dir: ".",
        platform: platform,
        version: electronVersion,
        ignore: ignoreFunc,
        overwrite: true,
        out: buildTmpPath
      }, function done(err, appPath) {
        if (err !== null) {
          log(err);
          reject();
        } else {
          // Rename the output dir to a one with a version number in it.
          mv(appPath[0], path.join(buildTmpPath, versionedOutputDir));
          
          const thisCD = pwd();
          cd(buildTmpPath);

          // Prune any unneeded node-sass binaries.
          pruneNodeSass(versionedOutputDir, arch, platform);
          copyWindowsNodeSassBinary(versionedOutputDir, platform);
          pruneEmojiOne(versionedOutputDir, platform);

          // Zip it up.
          log("Zipping up the package");

          mv(path.join(versionedOutputDir, "LICENSE"), path.join(versionedOutputDir, "LICENSE_electron.txt"));
          cp("extraterm/README.md", versionedOutputDir);
          cp("extraterm/LICENSE.txt", versionedOutputDir);
          
          exec(`zip -y -r ${outputZip} ${versionedOutputDir}`);
          cd(thisCD);
          
          log("App bundle written to " + versionedOutputDir);
          resolve();
        }
      });
    });
  }
  
  function replaceDirs(targetDir, replacementsDir) {
    const prevDir = pwd();
    cd(srcRootDir);
    const replacements = ls(replacementsDir);
    replacements.forEach( (rDir) => {
      const targetSubDir = path.join(targetDir, rDir);
      if (test('-d', targetSubDir)) {
        rm('-r', targetSubDir);
      }
      cp('-r', path.join(replacementsDir, rDir), targetSubDir);
    });  
    cd(prevDir);
  }
  
  replaceDirs(path.join(buildTmpPath, 'extraterm/node_modules'), 'src/build_scripts/node_modules-win32-x64');
  makePackage('x64', 'win32')
    .then( () => {
      replaceDirs(path.join(buildTmpPath, 'extraterm/node_modules'), 'src/build_scripts/node_modules-linux-x64');
      return makePackage('x64', 'linux'); })
    
    .then( () => {
      replaceDirs(path.join(buildTmpPath, 'extraterm/node_modules'), 'src/build_scripts/node_modules-linux-ia32');
      return makePackage('ia32', 'linux'); })
      
    .then( () => {
      replaceDirs(path.join(buildTmpPath, 'extraterm/node_modules'), 'src/build_scripts/node_modules-darwin-x64');
      return makePackage('x64', 'darwin'); })
      
    .then( () => { log("Done"); } );
}
main();
