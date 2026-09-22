import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import type { Pokemon } from '../src/lib/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
    __dirname,
    '../src/data/pokemon.json'
);

const imagesDir = path.resolve(
    __dirname,
    '../src/data/pokemonImages'
);

const downloadImage = async (pokedexNumber: number) => {
    const filePath = path.join(
        imagesDir,
        `${pokedexNumber}.png`
    );

    const response = await fetch(
        `https://www.serebii.net/pokemon/art/${pokedexNumber
            .toString()
            .padStart(3, '0')}.png`
    );

    if (!response.ok || !response.body) {
        throw new Error(
            `Download failed for #${pokedexNumber}: ${response.status}`
        );
    }

    await pipeline(
        Readable.fromWeb(
            // @ts-expect-error: this is ok
            response.body
        ),
        createWriteStream(filePath)
    );

    console.log(`Downloaded #${pokedexNumber} to ${filePath}`);
};

const downloadImages = async () => {
    const fileContents = await readFile(
        DATA_FILE,
        'utf-8'
    );

    const pokemon: Pokemon[] = JSON.parse(fileContents);

    console.log(
        `Found ${pokemon.length} Pokémon in JSON.`
    );

    await mkdir(imagesDir, { recursive: true });

    for (const currentPokemon of pokemon) {
        try {
            await downloadImage(currentPokemon.id);
        } catch (error) {
            console.error(
                `Failed to download #${currentPokemon.id} ${currentPokemon.name}:`,
                error
            );
        }
    }

    console.log(
        `Finished downloading Pokémon images to ${imagesDir}`
    );
};

await downloadImages();
