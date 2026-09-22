export type PokemonEvolution = {
    id: number;
    form?: string;
};

export type Pokemon = {
    id: number;
    name: string;
    types: string[];
    description?: string;
    generation?: number;
    variants?: string[];
    evolvedFrom?: PokemonEvolution[];
    evolvesTo?: PokemonEvolution[];
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
    pronunciations?: {
        phonetic: string;
        ipa: string;
    };
};

export enum AppRoutes {
    ID_CARD = '/id-card',
    WHOS_THAT_POKEMON = '/whos-that-pokemon'
}
