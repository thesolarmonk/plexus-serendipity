import bfj from 'bfj';
import fs from 'fs';
import path from 'path';
import { __dirname } from './path.js';

// Reads the data from a JSON file at the specified filepath
export function readJSON(filepath) {
  try {
    const data = fs.readFileSync(path.join(__dirname, filepath), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.e(`Error: Unable to read file at ${filepath}`, e);
  }

  return null;
}

export function readMappedJSON(filepath, mapKey) {
  const list = readJSON(filepath);

  const map = new Map();
  list.forEach((item) => {
    map.set(item[mapKey], item);
  });

  return map;
}

// Writes the data to a JSON file at the specified filepath
export function writeJSON(filepath, data) {
  try {
    fs.writeFileSync(path.join(__dirname, filepath), JSON.stringify(data));
  } catch (e) {
    console.error(`Error: Unable to write file to ${filepath}`, e);
  }
}

export function appendJSON(filepath, data) {
  try {
    fs.appendFileSync(path.join(__dirname, filepath), data);
  } catch (e) {
    console.error(`Error: Unable to write file to ${filepath}`, e);
  }
}

export async function writeLargeJSON(filepath, data) {
  await bfj.write(path.join(__dirname, filepath), data, {}).catch((e) => {
    console.error(e);
  });
}

export async function readLargeJSON(filepath) {
  try {
    const data = await bfj.read(path.join(__dirname, filepath), {}).then((data) => {
      return data;
    });

    // return JSON.parse(data);
  } catch (e) {
    console.error(`Error: Unable to read file at ${filepath}`, e);
  }

  return null;
}
