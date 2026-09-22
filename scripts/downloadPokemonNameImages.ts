import { launch, Page } from 'puppeteer';
import { mkdir, readFile, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pokemon } from '../src/lib/types';

const URL = 'https://textcraft.net/style/Textcraft/pokemon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
    __dirname,
    '../src/data/pokemon.json'
);

const OUTPUT_DIRECTORY = path.resolve(
    __dirname,
    '../src/data/pokemonNameImages'
);

const OVERWRITE = process.argv.includes('--overwrite');

const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
};

const fillTextInput = async (
    page: Page,
    text: string
): Promise<void> => {
    try {
        await page.waitForSelector('#yourtext', {
            timeout: 5000
        });

        await page.waitForSelector('#yourtext2', {
            timeout: 5000
        });

        await page.waitForSelector('#yourtext3', {
            timeout: 5000
        });

        await page.$eval('#yourtext2', (element) => {
            (element as HTMLInputElement).value = '';
        });

        await page.$eval('#yourtext3', (element) => {
            (element as HTMLInputElement).value = '';
        });

        await page.$eval('#yourtext', (element) => {
            (element as HTMLInputElement).value = '';
        });

        await page.type('#yourtext', text);

        return;
    } catch {
        // Fall through to the more generic form-based approach.
    }

    try {
        const form = await page.$('form');

        if (!form) {
            throw new Error('No form found');
        }

        for (const selector of ['#yourtext2', '#yourtext3']) {
            const element = await form.$(selector);

            if (element) {
                await element.evaluate((el) => {
                    (el as HTMLInputElement).value = '';
                });
            }
        }

        const firstInput = await form.$('input[type="text"]');

        if (!firstInput) {
            throw new Error('No text input found');
        }

        await firstInput.evaluate((element) => {
            (element as HTMLInputElement).value = '';
        });

        await firstInput.type(text);
    } catch (error) {
        throw new Error(
            'Could not locate the Textcraft text inputs on the page',
            { cause: error }
        );
    }
};

const clickGenerate = async (page: Page): Promise<void> => {
    const selectors = [
        '#createbutton',
        'button#createbutton',
        'button',
        'input[type="submit"]'
    ];

    for (const selector of selectors) {
        const elements = await page.$$(selector);

        for (const element of elements) {
            try {
                const text = await element.evaluate(
                    (el) => el.textContent?.trim().toLowerCase() ?? ''
                );

                if (
                    selector !== '#createbutton' &&
                    selector !== 'button#createbutton' &&
                    !text.includes('create')
                ) {
                    continue;
                }

                await element.click();
                return;
            } catch {
                // Try the next candidate.
            }
        }
    }

    throw new Error(
        'Could not locate the Create button on the Textcraft page'
    );
};

const extractGeneratedPng = async (
    page: Page
): Promise<Buffer> => {
    await page.waitForSelector('#output img', {
        timeout: 15000
    });

    const image = await page.$('#output img');

    if (!image) {
        throw new Error('Generated image was not found');
    }

    const src = await image.evaluate(
        (element) => element.getAttribute('src')
    );

    if (!src) {
        throw new Error(
            '#output img does not have a src attribute'
        );
    }

    if (src.startsWith('data:image/')) {
        const [, base64] = src.split(',', 2);

        if (!base64) {
            throw new Error('Generated image contains no data');
        }

        return Buffer.from(base64, 'base64');
    }

    if (
        src.startsWith('http://') ||
        src.startsWith('https://')
    ) {
        const response = await fetch(src);

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status} while downloading generated image`
            );
        }

        return Buffer.from(await response.arrayBuffer());
    }

    throw new Error(
        `Unsupported generated image source: ${src}`
    );
};

const generatePokemonNameImage = async (
    page: Page,
    name: string
): Promise<Buffer> => {
    await page.goto(URL, {
        waitUntil: 'domcontentloaded'
    });

    await page.waitForNetworkIdle({
        idleTime: 500,
        timeout: 15000
    }).catch(() => {
        // Some pages never become completely idle.
    });

    const initialSource = await page.$eval(
        '#output img',
        (element) => element.getAttribute('src')
    ).catch(() => null);

    await fillTextInput(page, name);
    await clickGenerate(page);

    await page.waitForFunction(
        (initial) => {
            const image = document.querySelector(
                '#output img'
            ) as HTMLImageElement | null;

            if (!image?.src) {
                return false;
            }

            const src = image.src;

            if (initial && src === initial) {
                return false;
            }

            if (src.startsWith('data:image/')) {
                return true;
            }

            if (/\/data\//.test(src)) {
                return true;
            }

            if (src.includes('/styles/')) {
                return false;
            }

            return false;
        },
        {
            timeout: 30000
        },
        initialSource
    ).catch(() => {
        // The image extraction below will provide a more useful
        // error if generation actually failed.
    });

    return extractGeneratedPng(page);
};

const scrapePokemonNameImages = async (): Promise<void> => {
    const fileContents = await readFile(DATA_FILE, 'utf-8');
    const pokemon = JSON.parse(fileContents) as Pokemon[];

    await mkdir(OUTPUT_DIRECTORY, {
        recursive: true
    });

    console.log(`Found ${pokemon.length} Pokémon in JSON.`);
    console.log(`Output directory: ${OUTPUT_DIRECTORY}`);

    const browser = await launch({
        headless: true
    });

    try {
        const page = await browser.newPage();

        for (const currentPokemon of pokemon) {
            const outputPath = path.join(
                OUTPUT_DIRECTORY,
                `${currentPokemon.id}.png`
            );

            if (
                !OVERWRITE &&
                await fileExists(outputPath)
            ) {
                console.log(
                    `Skipping #${currentPokemon.id} ${currentPokemon.name}: image already exists`
                );
                continue;
            }

            console.log(
                `Generating name image for #${currentPokemon.id} ${currentPokemon.name}`
            );

            try {
                const png = await generatePokemonNameImage(
                    page,
                    currentPokemon.name
                );

                await writeFile(outputPath, png);

                console.log(
                    `  Saved to ${outputPath}`
                );
            } catch (error) {
                console.error(
                    `  Failed to generate image for #${currentPokemon.id} ${currentPokemon.name}:`,
                    error
                );
            }
        }
    } finally {
        await browser.close();
    }
};

await scrapePokemonNameImages();
