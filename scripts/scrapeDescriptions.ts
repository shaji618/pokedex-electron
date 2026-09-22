import { launch, Page } from 'puppeteer';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pokemon } from '../src/lib/types';

const BASE_URL = 'https://thepokepedia.com/pokedex';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
    __dirname,
    '../src/data/pokemon.json'
);

const scrapeDescription = async (
    page: Page,
    id: number,
    name: string
): Promise<string> => {
    const slug = name
        .toLowerCase()
        .replace('♀', '-f')
        .replace('♂', '-m')
        .replaceAll("'", '')
        .replaceAll('.', '')
        .replace(/\s+/g, '-');

    const url = `${BASE_URL}/${slug}`;

    console.log(`Fetching #${id} ${name}: ${url}`);

    await page.goto(url, {
        waitUntil: 'networkidle2'
    });

    const paragraphs = await page.$$eval(
        '.space-y-16 > section:nth-of-type(1) > p',
        (elements) =>
            elements
                .map((element) => element.textContent?.trim() ?? '')
                .filter(Boolean)
    );

    return paragraphs.join(' ');
};

const kgToPoundsOunces = (kg: number) => {
    const totalOunces = Math.round(kg * 35.27396195);
    const pounds = Math.floor(totalOunces / 16);
    const ounces = totalOunces % 16;

    if (ounces === 0) return `${pounds}lbs`;
    if (pounds === 0) return `${ounces}oz`;

    return `${pounds}lbs ${ounces}oz`;
};

const metersToFeetInches = (meters: number) => {
    const totalInches = Math.round(meters * 39.37007874);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;

    if (feet === 0) return `${inches}"`;

    return inches === 0
        ? `${feet}'`
        : `${feet}'${inches}"`;
};

const addImperialValues = (sentence: string) => {
    return sentence
        .replace(/(\d+(?:\.\d+)?)m tall/, (_, meters) => {
            return `${metersToFeetInches(Number(meters))} (${meters}m) tall`;
        })
        .replace(/(\d+(?:\.\d+)?)kg/, (_, kg) => {
            return `${kgToPoundsOunces(Number(kg))} (${kg}kg)`;
        });
};

const scrapeDescriptions = async () => {
    const fileContents = await readFile(DATA_FILE, 'utf-8');
    const pokemon: Pokemon[] = JSON.parse(fileContents);

    console.log(`Found ${pokemon.length} Pokémon in JSON.`);

    const browser = await launch({
        headless: true
    });

    try {
        const page = await browser.newPage();

        for (const currentPokemon of pokemon) {
            try {
                const description = await scrapeDescription(
                    page,
                    currentPokemon.id,
                    currentPokemon.name
                );

                if (!description) {
                    console.warn(
                        `No description found for ${currentPokemon.name}`
                    );
                    continue;
                }

                const formattedDescription =
                    addImperialValues(description);

                if (
                    formattedDescription ===
                    currentPokemon.description
                ) {
                    console.log(
                        `  #${currentPokemon.id} ${currentPokemon.name}: description unchanged`
                    );
                    continue;
                }

                currentPokemon.description =
                    formattedDescription;

                console.log(
                    `  #${currentPokemon.id} ${currentPokemon.name}: description updated`
                );
            } catch (error) {
                console.error(
                    `  Failed to scrape ${currentPokemon.name}:`,
                    error
                );
            }
        }

        await writeFile(
            DATA_FILE,
            JSON.stringify(pokemon, null, 2),
            'utf-8'
        );

        console.log(`Updated Pokémon data in ${DATA_FILE}`);
    } finally {
        await browser.close();
    }
};

await scrapeDescriptions();
