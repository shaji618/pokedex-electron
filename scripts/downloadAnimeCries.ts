import { launch, Page } from 'puppeteer';
import AdmZip from 'adm-zip';
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile
} from 'node:fs/promises';
import {
    createWriteStream
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { Pokemon } from '../src/lib/types';

const MEDIAFIRE_URL =
    'https://www.mediafire.com/file/bwtoaxbvt2fnage/RealCries.zip/file';

const AUDIO_EXTENSIONS = new Set([
    '.wav',
    '.mp3',
    '.ogg',
    '.flac',
    '.m4a',
    '.aiff',
    '.au'
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
    __dirname,
    '../src/data/pokemon.json'
);

const CRIES_DIR = path.resolve(
    __dirname,
    '../src/data/animeCries'
);

const OVERWRITE = process.argv.includes('--overwrite');
const DRY_RUN = process.argv.includes('--dry-run');

const pokemonArgIndex = process.argv.indexOf('--pokemon');
const pokemonArg =
    pokemonArgIndex !== -1
        ? process.argv[pokemonArgIndex + 1]
        : undefined;

const getAllPokemon = async (): Promise<Pokemon[]> => {
    const contents = await readFile(DATA_FILE, 'utf-8');

    return JSON.parse(contents) as Pokemon[];
};

const findPokemon = (
    pokemon: Pokemon[],
    query: string
): Pokemon | undefined => {
    const id = Number(query);

    if (!Number.isNaN(id)) {
        return pokemon.find(
            (currentPokemon) => currentPokemon.id === id
        );
    }

    return pokemon.find(
        (currentPokemon) =>
            currentPokemon.name.toLowerCase() ===
            query.toLowerCase()
    );
};

const getDirectDownloadUrl = async (
    page: Page
): Promise<string> => {
    console.log(`Fetching MediaFire page: ${MEDIAFIRE_URL}`);

    await page.goto(MEDIAFIRE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
    });

    const downloadUrl = await page.$eval(
        '#downloadButton',
        (element) => element.getAttribute('href')
    );

    if (!downloadUrl) {
        throw new Error(
            'Could not find MediaFire download button'
        );
    }

    return downloadUrl;
};

const downloadFile = async (
    url: string,
    destination: string
): Promise<void> => {
    console.log('Downloading RealCries...');

    const response = await fetch(url);

    if (!response.ok || !response.body) {
        throw new Error(
            `Download failed: ${response.status} ${response.statusText}`
        );
    }

    await pipeline(
        Readable.fromWeb(
            // @ts-expect-error: this is ok
            response.body
        ),
        createWriteStream(destination)
    );

    console.log(`Downloaded ZIP to ${destination}`);
};

const extractCries = (
    zipPath: string
): Map<number, Buffer[]> => {
    const zip = new AdmZip(zipPath);
    const cries = new Map<number, Buffer[]>();

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) {
            continue;
        }

        const filename = path.basename(entry.entryName);
        const extension = path.extname(filename).toLowerCase();

        if (!AUDIO_EXTENSIONS.has(extension)) {
            continue;
        }

        const match = filename.match(/^(\d{1,4})/);

        if (!match) {
            continue;
        }

        const pokedexNumber = Number(match[1]);
        const existing = cries.get(pokedexNumber) ?? [];

        existing.push(entry.getData());
        cries.set(pokedexNumber, existing);
    }

    return cries;
};

const saveCry = async (
    pokemon: Pokemon,
    cryData: Buffer
): Promise<void> => {
    await mkdir(CRIES_DIR, {
        recursive: true
    });

    const destination = path.join(
        CRIES_DIR,
        `${pokemon.id}.wav`
    );

    if (!OVERWRITE) {
        try {
            await readFile(destination);

            console.log(
                `  #${pokemon.id} ${pokemon.name}: already exists, skipping`
            );

            return;
        } catch {
            // File doesn't exist; continue.
        }
    }

    if (DRY_RUN) {
        console.log(
            `  [DRY RUN] Would write #${pokemon.id} ${pokemon.name} → ${destination}`
        );

        return;
    }

    await writeFile(destination, cryData);

    console.log(
        `  #${pokemon.id} ${pokemon.name}: wrote ${destination}`
    );
};

const downloadAnimeCries = async (): Promise<void> => {
    const pokemon = await getAllPokemon();

    console.log(
        `Found ${pokemon.length} Pokémon in JSON.`
    );

    const targets = pokemonArg
        ? (() => {
            const match = findPokemon(pokemon, pokemonArg);

            if (!match) {
                throw new Error(
                    `Could not find Pokémon: ${pokemonArg}`
                );
            }

            return [match];
        })()
        : pokemon;

    console.log(
        `Processing ${targets.length} Pokémon.`
    );

    const browser = await launch({
        headless: true
    });

    let tempDirectory: string | undefined;

    try {
        const page = await browser.newPage();

        const directUrl = await getDirectDownloadUrl(page);

        tempDirectory = await mkdtemp(
            path.join(process.cwd(), 'realcries-')
        );

        const zipPath = path.join(
            tempDirectory,
            'RealCries.zip'
        );

        await downloadFile(directUrl, zipPath);

        console.log('Reading cry files from ZIP...');

        const cries = extractCries(zipPath);

        console.log(
            `Found cries for ${cries.size} Pokédex numbers.`
        );

        for (const currentPokemon of targets) {
            try {
                const files = cries.get(currentPokemon.id);

                if (!files || files.length === 0) {
                    console.warn(
                        `  #${currentPokemon.id} ${currentPokemon.name}: no cry found`
                    );

                    continue;
                }

                if (files.length > 1) {
                    console.warn(
                        `  #${currentPokemon.id} ${currentPokemon.name}: ${files.length} cries found; using the first`
                    );
                }

                await saveCry(
                    currentPokemon,
                    files[0]
                );
            } catch (error) {
                console.error(
                    `  Failed to process #${currentPokemon.id} ${currentPokemon.name}:`,
                    error
                );
            }
        }
    } finally {
        await browser.close();

        if (tempDirectory) {
            await rm(tempDirectory, {
                recursive: true,
                force: true
            });
        }
    }
};

await downloadAnimeCries();
