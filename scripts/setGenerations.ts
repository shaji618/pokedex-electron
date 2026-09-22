import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pokemon } from '../src/lib/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
    __dirname,
    '../src/data/pokemon.json'
);

type GenerationRange = {
    generation: number;
    lowerBound: number;
    upperBound: number;
};

const generations: GenerationRange[] = [
    { generation: 1, lowerBound: 1, upperBound: 151 },
    { generation: 2, lowerBound: 152, upperBound: 251 },
    { generation: 3, lowerBound: 252, upperBound: 386 },
    { generation: 4, lowerBound: 387, upperBound: 493 },
    { generation: 5, lowerBound: 494, upperBound: 649 },
    { generation: 6, lowerBound: 650, upperBound: 721 },
    { generation: 7, lowerBound: 722, upperBound: 809 },
    { generation: 8, lowerBound: 810, upperBound: 905 },
    { generation: 9, lowerBound: 906, upperBound: 1025 }
];

const setGeneration = (
    pokemon: Pokemon[],
    {
        generation,
        lowerBound,
        upperBound
    }: GenerationRange
) => {
    console.log(
        `Setting generation ${generation} for Pokémon #${lowerBound}-#${upperBound}`
    );

    for (const currentPokemon of pokemon) {
        if (
            currentPokemon.id >= lowerBound &&
            currentPokemon.id <= upperBound
        ) {
            currentPokemon.generation = generation;
        }
    }
};

const updateGenerations = async () => {
    const fileContents = await readFile(DATA_FILE, 'utf-8');
    const pokemon: Pokemon[] = JSON.parse(fileContents);

    console.log(`Found ${pokemon.length} Pokémon in JSON.`);

    for (const generation of generations) {
        setGeneration(pokemon, generation);
    }

    await writeFile(
        DATA_FILE,
        JSON.stringify(pokemon, null, 2),
        'utf-8'
    );

    console.log(`Updated generations in ${DATA_FILE}`);
};

await updateGenerations();
