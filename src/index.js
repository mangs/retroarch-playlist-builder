#!/usr/bin/env node


// Verify command correctness
if (process.argv.length < 5) {
  console.error('USAGE: node index.js <BASE_PATH> <PLAYLIST_FILE_NAME> <FILE_MATCH_PATTERNS> <OUTPUT_BASE_PATH_OVERRIDE>');
  process.exit(1);
}


// Module Imports
const { crc32 } = require('crc');
const fs = require('fs');
// const fsPromises = fs.promises; // Use when no longer considered experimental
const globby = require('globby');
const path = require('path');


// Constants
const BASE_PATH = process.argv[2];
const BUILD_PATH = './build/';
const FILE_MATCH_PATTERN_ARG = process.argv[4];
const FILE_MATCH_PATTERN_LIST = FILE_MATCH_PATTERN_ARG.split(',');
const GLOBBY_DEFAULT_OPTIONS = {
  dot: true,
  expandDirectories: false,
  onlyFiles: true,
};
const OUTPUT_BASE_PATH_OVERRIDE = process.argv[5];
const PLAYLIST_FILE_NAME = process.argv[3];


// Local Functions

// Find all files for which a playlist entry should be created
function matchFiles(patterns, globbyOptionOverrides={}) {
  const globbyInstanceOptions = {
    ...GLOBBY_DEFAULT_OPTIONS,
    ...globbyOptionOverrides,
  };
  return globby(patterns, globbyInstanceOptions);
}

// Build a JSON-based playlist
async function buildPlaylist(targetFilePaths=[]) {
  const playlistEntries = targetFilePaths.map(filePathRelative => {
    const filePathAbsolute = path.join(BASE_PATH, filePathRelative);
    const fileMeta = path.parse(filePathAbsolute);
    const fileContents = fs.readFileSync(filePathAbsolute, { encoding: 'utf8' }); // Sync because Array.prototype.map does not support async
    const fileHash = crc32(fileContents).toString(16);
    const outputFilePathAbsolute =
      (OUTPUT_BASE_PATH_OVERRIDE
        ? path.join(OUTPUT_BASE_PATH_OVERRIDE, filePathRelative)
        : filePathAbsolute)
      .replace(/\\\//g, '\\') // Convert to Windows-formatted path
      .replace('/', '\\');

    return {
      core_name: 'DETECT',
      core_path: 'DETECT',
      crc32: fileHash,
      db_name: PLAYLIST_FILE_NAME,
      label: fileMeta.name,
      path: outputFilePathAbsolute,
    };
  });

  return {
    version: '1.2',
    default_core_path: '',
    default_core_name: '',
    label_display_mode: 0,
    right_thumbnail_mode: 0,
    left_thumbnail_mode: 0,
    items: playlistEntries,
  };
}

async function main() {
  try {
    // Search the filesystem
    const globbyOptions = { cwd: BASE_PATH };
    console.info('Searching for file matches...');
    console.info(`\tBase path: ${BASE_PATH}`);
    console.info(`\tPatterns to match: ${FILE_MATCH_PATTERN_ARG}`);
    console.info(`\tGlobby options: ${JSON.stringify(globbyOptions)}`);
    const fileMatches = await matchFiles(FILE_MATCH_PATTERN_LIST, globbyOptions);
    console.info('DONE\n');

    // Build the playlist
    console.info('Building playlist...');
    const outputFilePath = path.join(BUILD_PATH, PLAYLIST_FILE_NAME);
    const playlist = await buildPlaylist(fileMatches);
    const playlistJSON = JSON.stringify(playlist);
    const playlistFileMetadata = { encoding: 'utf8' };
    console.info('DONE\n');

    // Write the generated data to disk
    console.info(`Writing file to disk: ${outputFilePath}`)
    await fs.writeFileSync(`${BUILD_PATH}${PLAYLIST_FILE_NAME}`, playlistJSON, playlistFileMetadata);
    console.info('DONE\n');
  } catch (exception) {
    console.error('AN UNEXPECTED ERROR OCCURRED:\n', exception);
    return 1;
  }
}


// Begin Execution
main()
  .then(returnValue => process.exit(returnValue));
