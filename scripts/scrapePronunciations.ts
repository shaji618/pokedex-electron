import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

import { Pokemon } from '../src/lib/types';

const BASE_URL = 'https://pokemonlp.fandom.com';
const API_URL = `${BASE_URL}/api.php`;

const GENERATIONS = [
    { number: 1, roman: 'I' },
    { number: 2, roman: 'II' },
    { number: 3, roman: 'III' },
    { number: 4, roman: 'IV' },
    { number: 5, roman: 'V' },
    { number: 6, roman: 'VI' },
    { number: 7, roman: 'VII' },
    { number: 8, roman: 'VIII' },
    { number: 9, roman: 'IX' }
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, '../src/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'pokemon.json');

type Pronunciation = {
    dex: number;
    name: string;
    phonetic: string;
    ipa: string;
};

type ApiResponse = {
    parse?: {
        title?: string;
        text?: string;
    };
    error?: {
        code?: string;
        info?: string;
    };
};

const normalizeText = (
    value: string | null | undefined
): string => {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const sleep = async (
    milliseconds: number
): Promise<void> => {
    await new Promise((resolve) =>
        setTimeout(resolve, milliseconds)
    );
};

const getApiUrl = (roman: string): string => {
    const page = `Pokémon Pronunciation Guide/Generation_${roman}`;

    const params = new URLSearchParams({
        action: 'parse',
        page,
        prop: 'text',
        format: 'json',
        formatversion: '2'
    });

    return `${API_URL}?${params.toString()}`;
};

const fetchGenerationHtml = async (
    generation: number,
    roman: string
): Promise<string> => {
    const url = getApiUrl(roman);

    console.log(`  Fetching Generation ${generation}...`);

    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'Pokedex pronunciation scraper/1.0'
        }
    });

    if (!response.ok) {
        throw new Error(
            `Generation ${generation}: HTTP ${response.status} ${response.statusText}`
        );
    }

    const data = (await response.json()) as ApiResponse;

    if (data.error) {
        throw new Error(
            `Generation ${generation}: ${
                data.error.code ?? 'API error'
            } - ${data.error.info ?? 'Unknown error'}`
        );
    }

    const html = data.parse?.text;

    if (!html) {
        throw new Error(
            `Generation ${generation}: API response did not contain page HTML`
        );
    }

    return html;
};

const getDexFromCell = (
    text: string
): number | null => {
    const match = text.match(/^#?(\d{4})$/);

    if (!match) {
        return null;
    }

    return Number(match[1]);
};

const looksLikeIpa = (text: string): boolean => {
    if (!text) {
        return false;
    }

    if (text.startsWith('/') || text.endsWith('/')) {
        return true;
    }

    return /[ˈˌɪʊəɛɔɑɒɐʌɚɝɹʃʒθðŋɡɲçʎ]/u.test(
        text
    );
};

const extractPronunciationFromCells = (
    cellTexts: string[]
): Pronunciation | null => {
    if (cellTexts.length < 4) {
        return null;
    }

    let dexIndex = -1;
    let dex: number | null = null;

    for (let i = 0; i < cellTexts.length; i++) {
        const candidateDex = getDexFromCell(
            cellTexts[i]
        );

        if (candidateDex !== null) {
            dexIndex = i;
            dex = candidateDex;
            break;
        }
    }

    if (dexIndex === -1 || dex === null) {
        return null;
    }

    const nameIndex = dexIndex + 1;

    if (nameIndex >= cellTexts.length) {
        return null;
    }

    const name = cellTexts[nameIndex];

    if (!name) {
        return null;
    }

    let ipaIndex = -1;

    for (
        let i = cellTexts.length - 1;
        i > nameIndex;
        i--
    ) {
        if (looksLikeIpa(cellTexts[i])) {
            ipaIndex = i;
            break;
        }
    }

    if (ipaIndex === -1) {
        return null;
    }

    const phoneticIndex = ipaIndex - 1;

    if (phoneticIndex <= nameIndex) {
        return null;
    }

    const phonetic = cellTexts[phoneticIndex];

    if (!phonetic) {
        return null;
    }

    const ipa = cellTexts[ipaIndex];

    if (!ipa) {
        return null;
    }

    return {
        dex,
        name,
        phonetic,
        ipa
    };
};

const extractPronunciations = (
    html: string,
    generation: number
): Pronunciation[] => {
    const $ = load(html);

    const results: Pronunciation[] = [];

    $('table').each((_tableIndex, table) => {
        const headerText = $(table)
            .find('th')
            .map((_index, header) =>
                normalizeText($(header).text()).toLowerCase()
            )
            .get()
            .join(' ');

        if (
            !headerText.includes('pronunciation') ||
            !headerText.includes('ipa')
        ) {
            return;
        }

        console.log(
            `  Generation ${generation}: found pronunciation table`
        );

        $(table)
            .find('tr')
            .each((_rowIndex, row) => {
                const cellTexts = $(row)
                    .find('td')
                    .toArray()
                    .map((cell) =>
                        normalizeText($(cell).text())
                    );

                const pronunciation =
                    extractPronunciationFromCells(
                        cellTexts
                    );

                if (!pronunciation) {
                    return;
                }

                results.push(pronunciation);
            });

        return false;
    });

    console.log(
        `  Generation ${generation}: found ${results.length} entries`
    );

    return results;
};

const scrapePronunciations = async (): Promise<void> => {
    console.log(
        'Loading pronunciation data from Fandom API...'
    );

    const pronunciationIndex =
        new Map<number, Pronunciation>();

    for (const generation of GENERATIONS) {
        try {
            const html = await fetchGenerationHtml(
                generation.number,
                generation.roman
            );

            const pronunciations =
                extractPronunciations(
                    html,
                    generation.number
                );

            for (const pronunciation of pronunciations) {
                if (
                    !pronunciationIndex.has(
                        pronunciation.dex
                    )
                ) {
                    pronunciationIndex.set(
                        pronunciation.dex,
                        pronunciation
                    );
                }
            }
        } catch (error) {
            console.error(
                `  Failed to scrape Generation ${generation.number}:`,
                error
            );
        }

        await sleep(400);
    }

    console.log(
        `Collected ${pronunciationIndex.size} unique pronunciation entries`
    );

    if (pronunciationIndex.size === 0) {
        throw new Error(
            'No pronunciation entries were scraped from any generation page.'
        );
    }

    console.log(`Reading ${OUTPUT_FILE}...`);

    const json = await readFile(
        OUTPUT_FILE,
        'utf-8'
    );

    const pokemon = JSON.parse(json) as Pokemon[];

    let updated = 0;
    let unchanged = 0;
    let missing = 0;

    for (const pokemonEntry of pokemon) {
        const pronunciation =
            pronunciationIndex.get(
                pokemonEntry.id
            );

        if (!pronunciation) {
            console.log(
                `No pronunciation found for #${String(
                    pokemonEntry.id
                ).padStart(4, '0')} ${pokemonEntry.name}`
            );

            missing++;
            continue;
        }

        const next = {
            phonetic: pronunciation.phonetic,
            ipa: pronunciation.ipa
        };

        const previous =
            pokemonEntry.pronunciations;

        const isSame =
            previous?.phonetic === next.phonetic &&
            previous?.ipa === next.ipa;

        if (isSame) {
            unchanged++;
            continue;
        }

        pokemonEntry.pronunciations = next;

        updated++;

        console.log(
            `Updated #${String(
                pokemonEntry.id
            ).padStart(4, '0')} ${pokemonEntry.name}:`
        );

        console.log(
            `  Phonetic: ${next.phonetic}`
        );

        console.log(
            `  IPA:      ${next.ipa}`
        );

        if (previous) {
            console.log(
                `  Previous phonetic: ${previous.phonetic}`
            );

            console.log(
                `  Previous IPA:      ${previous.ipa}`
            );
        } else {
            console.log('  Previous: none');
        }
    }

    await mkdir(OUTPUT_DIR, {
        recursive: true
    });

    await writeFile(
        OUTPUT_FILE,
        JSON.stringify(pokemon, null, 2),
        'utf-8'
    );

    console.log('');
    console.log('Pronunciation scrape complete.');
    console.log(`Updated: ${updated}`);
    console.log(`Unchanged: ${unchanged}`);
    console.log(`Missing: ${missing}`);
    console.log(`Total Pokémon: ${pokemon.length}`);
    console.log(`Wrote data to ${OUTPUT_FILE}`);
};

scrapePronunciations().catch((error) => {
    console.error(
        'Failed to scrape pronunciations:',
        error
    );

    process.exit(1);
});
