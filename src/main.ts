import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { URL } from 'url';

const packagesDir = 'packages';
const installedDir = 'installed';
const baseUrl = 'https://pkg.ngpm.dev/packages'; // Replace with the URL you want to fetch from

async function listPackages() {
  const packages = fs.readdirSync(packagesDir);
  packages.forEach(pkg => {
    const packagePath = path.join(packagesDir, pkg, 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      console.log(`Package: ${packageInfo.name}, Version: ${packageInfo.version}`);
    }
  });
}

async function fetchPackage(packageName: string, version: string) {
  const packageUrl = new URL(`${packageName}@v-${version}`, baseUrl).toString();
  const response = await axios.get(packageUrl, { responseType: 'stream' });

  const packagePath = path.join(packagesDir, `${packageName}@v-${version}`);
  if (fs.existsSync(packagePath)) {
    console.log(`Package ${packageName}@${version} is already downloaded.`);
    return;
  }

  fs.mkdirSync(packagePath, { recursive: true });

  const dest = path.join(packagePath, 'package.zip');
  const writer = createWriteStream(dest);

  await pipeline(response.data, writer);
  console.log(`Package ${packageName}@${version} downloaded.`);
}

async function installPackage(packageName: string, version: string) {
  const packagePath = path.join(packagesDir, `${packageName}@v-${version}`);
  if (!fs.existsSync(packagePath)) {
    console.log(`Package ${packageName}@${version} not found.`);
    return;
  }

  const installedPackagePath = path.join(installedDir, `${packageName}@v-${version}`);
  if (fs.existsSync(installedPackagePath)) {
    console.log(`Package ${packageName}@${version} is already installed.`);
    return;
  }

  fs.mkdirSync(installedPackagePath, { recursive: true });
  fs.readdirSync(packagePath).forEach(file => {
    const srcPath = path.join(packagePath, file);
    const destPath = path.join(installedPackagePath, file);
    if (fs.lstatSync(srcPath).isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
  console.log(`Package ${packageName}@${version} installed.`);
}

async function buildPackage(packageName: string, version: string) {
  const packagePath = path.join(installedDir, `${packageName}@v-${version}`);
  const packageJsonPath = path.join(packagePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`Package ${packageName}@${version} is not installed.`);
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.scripts && packageJson.scripts.build) {
    const buildScript = packageJson.scripts.build;
    execSync(`cd ${packagePath} && ${buildScript}`, { stdio: 'inherit' });
    console.log(`Package ${packageName}@${version} built.`);
  } else {
    console.log(`No build script found for package ${packageName}@${version}.`);
  }
}

async function main() {
  if (!fs.existsSync(installedDir)) {
    fs.mkdirSync(installedDir);
  }

  console.log('1. List packages');
  console.log('2. Install package');
  console.log('3. Build package');

  const choice = await prompt('Choose an option: ');

  if (choice === '1') {
    listPackages();
  } else if (choice === '2') {
    const packageName = await prompt('Enter the package name to install: ');
    const version = await prompt('Enter the package version: ');
    await fetchPackage(packageName, version);
    await installPackage(packageName, version);
  } else if (choice === '3') {
    const packageName = await prompt('Enter the package name to build: ');
    const version = await prompt('Enter the package version: ');
    await buildPackage(packageName, version);
  } else {
    console.log('Invalid option.');
  }
}

function prompt(question: string): Promise<string> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise<string>((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

main();