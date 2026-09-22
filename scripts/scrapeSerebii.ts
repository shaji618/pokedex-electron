import { launch } from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pokemon } from '../src/lib/types';

const URL = 'https://www.serebii.net/pokemon/nationalpokedex.shtml';

// In ESM, __dirname doesn't exist, so derive it from import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// scripts/ -> project root -> src/data/
const OUTPUT_DIR = path.resolve(__dirname, '../src/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'pokemon.json');

const extractPokemon = (rows: Element[]): Pokemon[] => {
    const values: Pokemon[] = [];

    for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));

        if (cells.length < 12) {
            continue;
        }

        const no = cells[0].textContent?.replace(/\s+/g, ' ').trim() ?? '';

        if (!/^#?\d{4,5}$/.test(no)) {
            continue;
        }

        const types: string[] = [];

        for (const anchor of cells[4].querySelectorAll('a')) {
            const value = anchor
                .getAttribute('href')
                ?.replace('/pokemon/type/', '')
                .trim();

            if (value) {
                types.push(value);
            }
        }

        const id = Number(
            no.replace(/^#/, '').replace(/^0*/, '')
        );

        console.log(`Scraping row for ${cells[3].textContent}`);

        values.push({
            id,
            name: cells[3].textContent?.replace(/\s+/g, ' ').trim() ?? '',
            types,
            hp: Number(
                cells[6].textContent?.replace(/\s+/g, ' ').trim() ?? ''
            ),
            attack: Number(
                cells[7].textContent?.replace(/\s+/g, ' ').trim() ?? ''
            ),
            defense: Number(
                cells[8].textContent?.replace(/\s+/g, ' ').trim() ?? ''
            ),
            specialAttack: Number(
                cells[9].textContent?.replace(/\s+/g, ' ').trim() ?? ''
            ),
            specialDefense: Number(
                cells[10].textContent?.replace(/\s+/g, ' ').trim() ?? ''
            ),
            speed: Number(
                cells[11].textContent?.replace(/\s+/g, ' ').trim() ?? ''
            )
        });
    }

    return values;
};

const scrapeSerebii = async () => {
    const browser = await launch({
        headless: true
    });

    try {
        const page = await browser.newPage();

        page.on('console', (message) => {
            console.log(message.text());
        });

        await page.goto(URL, {
            waitUntil: 'domcontentloaded'
        });

        const pokemon = await page.$$eval(
            'table.dextable tbody tr',
            extractPokemon
        );

        await mkdir(OUTPUT_DIR, {
            recursive: true
        });

        await writeFile(
            OUTPUT_FILE,
            JSON.stringify(pokemon, null, 2),
            'utf-8'
        );

        console.log(`Upserted ${pokemon.length} Pokémon`);
        console.log(`Wrote Pokémon data to ${OUTPUT_FILE}`);
    } finally {
        await browser.close();
    }
};

scrapeSerebii().catch((error) => {
    console.error(error);
    process.exit(1);
});
