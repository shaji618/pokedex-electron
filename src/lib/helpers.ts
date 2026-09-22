import type { Pokemon } from './types';
import pokemon from '../data/pokemon.json';

export const getAllPokemon = (): Pokemon[] => pokemon;

export const getRandomPokemon = (): Pokemon => {
    const allPokemon = getAllPokemon();

    return allPokemon[
        Math.floor(Math.random() * allPokemon.length)
    ];
};

export const getSinglePokemon = (
    args: { id?: number; name?: string }
): Pokemon | undefined => {
    const { id, name } = args;

    if (id === undefined && name === undefined) {
        return undefined;
    }

    return getAllPokemon().find((currentPokemon) => {
        if (id !== undefined) {
            return currentPokemon.id === id;
        }

        return currentPokemon.name.toLowerCase() === name?.toLowerCase();
    });
};

export const getImageForPokemon = (
    args: { id?: number; name?: string }
): string | undefined => {
    const pokemonImages = import.meta.glob(
        '../data/pokemonImages/*.png',
        {
            eager: true,
            import: 'default',
            query: '?url'
        }
    ) as Record<string, string>;

    const currentPokemon = getSinglePokemon(args);

    if (!currentPokemon) {
        return undefined;
    }

    const imagePath = `../data/pokemonImages/${currentPokemon.id}.png`;

    return pokemonImages[imagePath];
};

export const getNameImageForPokemon = (
    args: { id?: number; name?: string }
): string | undefined => {
    const pokemonImages = import.meta.glob(
        '../data/pokemonNameImages/*.png',
        {
            eager: true,
            import: 'default',
            query: '?url'
        }
    ) as Record<string, string>;

    const currentPokemon = getSinglePokemon(args);

    if (!currentPokemon) {
        return undefined;
    }

    const imagePath = `../data/pokemonNameImages/${currentPokemon.id}.png`;

    return pokemonImages[imagePath];
};

export const getCryForPokemon = (
    args: { id?: number; name?: string }
): string | undefined => {
    const pokemonCries = import.meta.glob(
        '../data/animeCries/*.wav',
        {
            eager: true,
            import: 'default',
            query: '?url'
        }
    ) as Record<string, string>;

    const currentPokemon = getSinglePokemon(args);

    if (!currentPokemon) {
        return undefined;
    }

    const cryPath = `../data/animeCries/${currentPokemon.id}.wav`;

    return pokemonCries[cryPath];
};
