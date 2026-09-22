import { launch, Page } from 'puppeteer';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pokemon } from '../src/lib/types';

const BASE_URL = 'https://www.serebii.net/pokemon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
    __dirname,
    '../src/data/pokemon.json'
);

const normalizeVariant = (
    value: string
): string | null => {
    const normalized = value
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    return normalized || null;
};

const normalizeVariants = (
    values: string[]
): string[] => {
    const seen = new Set<string>();
    const variants: string[] = [];

    for (const value of values) {
        const normalized =
            normalizeVariant(value);

        if (
            normalized === null ||
            seen.has(normalized)
        ) {
            continue;
        }

        seen.add(normalized);
        variants.push(normalized);
    }

    return variants;
};

const scrapeVariantFromPage = async (
    page: Page,
    id: number,
    name: string
): Promise<string[]> => {
    const slug = name
        .toLowerCase()
        .replace('♀', 'f')
        .replace('♂', 'm')
        .replace(/\s+/g, '');

    const url = `${BASE_URL}/${slug}`;

    console.log(
        `Fetching #${id} ${name}: ${url}`
    );

    await page.goto(url, {
        waitUntil: 'networkidle2'
    });

    const result = await page.evaluate(() => {
        const alternateFormsHeader =
            Array.from(
                document.querySelectorAll('td.fooevo')
            ).find((element) =>
                element.textContent
                    ?.includes('Alternate Forms')
            );

        if (!alternateFormsHeader) {
            return {
                found: false,
                variants: []
            };
        }

        const section =
            alternateFormsHeader.closest(
                'table'
            ) ?? alternateFormsHeader.parentElement;

        if (!section) {
            return {
                found: true,
                variants: []
            };
        }

        const variants: string[] = [];

        const elements = Array.from(
            section.querySelectorAll(
                'td.pkmn'
            )
        );

        for (const element of elements) {
            const value =
                element.textContent
                    ?.replace(/\s+/g, ' ')
                    .trim() ?? '';

            if (!value) {
                continue;
            }

            if (
                value
                    .toLowerCase()
                    .includes('tera type')
            ) {
                continue;
            }

            variants.push(value);
        }

        return {
            found: true,
            variants
        };
    });

    if (!result.found) {
        console.log(
            `  #${id} ${name} has no Alternate Forms section`
        );

        return [];
    }

    const variants = normalizeVariants(
        result.variants
    );

    if (variants.length > 0) {
        console.log(
            `  #${id} ${name} variants: ${variants.join(', ')}`
        );
    } else {
        console.log(
            `  #${id} ${name} has no variants`
        );
    }

    return variants;
};

const arraysEqual = (
    a: string[],
    b: string[]
): boolean => {
    return (
        a.length === b.length &&
        a.every(
            (value, index) =>
                value === b[index]
        )
    );
};

const scrapeVariants = async (
    dryRun: boolean
): Promise<void> => {
    const fileContents = await readFile(
        DATA_FILE,
        'utf-8'
    );

    const pokemon = JSON.parse(
        fileContents
    ) as Pokemon[];

    console.log(
        `Found ${pokemon.length} Pokémon in JSON.`
    );

    if (dryRun) {
        console.log(
            'Dry run enabled. No changes will be written.'
        );
    }

    const browser = await launch({
        headless: true
    });

    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    try {
        const page = await browser.newPage();

        for (const currentPokemon of pokemon) {
            try {
                const variants =
                    await scrapeVariantFromPage(
                        page,
                        currentPokemon.id,
                        currentPokemon.name
                    );

                const previous =
                    currentPokemon.variants ?? [];

                if (
                    arraysEqual(
                        previous,
                        variants
                    )
                ) {
                    unchanged++;
                    continue;
                }

                updated++;

                console.log(
                    `  ${dryRun ? '[DRY RUN] ' : ''}Would update #${currentPokemon.id} ${currentPokemon.name}`
                );

                console.log(
                    `    Previous: ${
                        previous.length > 0
                            ? previous.join(', ')
                            : '(none)'
                    }`
                );

                console.log(
                    `    Current:  ${
                        variants.length > 0
                            ? variants.join(', ')
                            : '(none)'
                    }`
                );

                if (!dryRun) {
                    currentPokemon.variants =
                        variants;
                }
            } catch (error) {
                failed++;

                console.error(
                    `  Failed to scrape ${currentPokemon.name}:`,
                    error
                );
            }
        }
    } finally {
        await browser.close();
    }

    if (!dryRun) {
        await writeFile(
            DATA_FILE,
            JSON.stringify(
                pokemon,
                null,
                2
            ),
            'utf-8'
        );
    }

    console.log('');
    console.log(
        dryRun
            ? 'Variant scrape dry run complete.'
            : 'Variant scrape complete.'
    );
    console.log(`Would update/Updated: ${updated}`);
    console.log(`Unchanged: ${unchanged}`);
    console.log(`Failed: ${failed}`);
    console.log(
        `Total Pokémon: ${pokemon.length}`
    );

    if (dryRun) {
        console.log(
            'No changes were written to pokemon.json.'
        );
    } else {
        console.log(
            `Wrote data to ${DATA_FILE}`
        );
    }
};

const dryRun =
    process.argv.includes('--dry-run');

await scrapeVariants(dryRun);
