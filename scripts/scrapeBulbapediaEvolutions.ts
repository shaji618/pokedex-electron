import puppeteer from 'puppeteer';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pokemon } from '../src/lib/types';

const URL =
    'https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_evolutionary_line';

const DRY_RUN = process.argv.includes('--dry-run');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
    __dirname,
    '../src/data/pokemon.json'
);

type EvolutionStage = {
    id: number;
    name: string;
    variant: string | null;
};

type EvolutionRecord = {
    id: number;
    name: string;
    variant: string | null;
    evolvedFrom: number | null;
    evolvedFromVariant: string | null;
    evolvesTo: { id: number; form?: string }[];
};

type RawCell = {
    id: number;
    text: string;
    colspan: number;
    rowspan: number;
    stage: EvolutionStage | null;
    sprite: string | null;
};

type RawTable = {
    rows: RawCell[][];
};

/**
 * Extract only serializable DOM data in Chromium.
 *
 * All actual evolution processing happens in Node so Puppeteer
 * doesn't have to execute our TypeScript helper functions.
 */
const scrapeEvolutionTables = async (): Promise<RawTable[]> => {
    const browser = await puppeteer.launch({
        headless: true
    });

    try {
        const page = await browser.newPage();

        await page.goto(URL, {
            waitUntil: 'domcontentloaded'
        });

        const tables = await page.evaluate(() => {
            const result: RawTable[] = [];
            let cellId = 0;

            const tableElements =
                document.querySelectorAll('table.roundy');

            for (
                let tableIndex = 0;
                tableIndex < tableElements.length;
                tableIndex += 1
            ) {
                const table = tableElements[tableIndex];
                const rows: RawCell[][] = [];

                const rowElements =
                    table.querySelectorAll('tr');

                for (
                    let rowIndex = 0;
                    rowIndex < rowElements.length;
                    rowIndex += 1
                ) {
                    const row = rowElements[rowIndex];
                    const cells: RawCell[] = [];

                    const cellElements =
                        row.querySelectorAll('td');

                    for (
                        let cellIndex = 0;
                        cellIndex < cellElements.length;
                        cellIndex += 1
                    ) {
                        const cell = cellElements[cellIndex];

                        const colspan = Number(
                            cell.getAttribute('colspan') ?? 1
                        );

                        const rowspan = Number(
                            cell.getAttribute('rowspan') ?? 1
                        );

                        const label = cell.querySelector(
                            'a[title$="(Pokémon)"] > span'
                        );

                        const sprite =
                            cell.parentElement
                                ?.querySelector('img')
                                ?.getAttribute('src') ?? null;

                        let stage: EvolutionStage | null = null;

                        if (label) {
                            const labelText =
                                label.textContent?.trim() ?? '';

                            const spriteSource =
                                cell
                                    .parentElement
                                    ?.querySelector('img')
                                    ?.getAttribute('src') ?? null;

                            const dexNumber =
                                spriteSource?.match(
                                    /\/(\d{3,4})[^/]*\.png/i
                                )?.[1];

                            if (dexNumber) {
                                const variantText =
                                    cell.querySelector('small')
                                        ?.textContent
                                        ?.replace(/\sForm$/, '')
                                        .trim()
                                        .toLowerCase() ?? '';

                                stage = {
                                    id: Number(dexNumber),
                                    name: labelText,
                                    variant:
                                        variantText || null
                                };
                            }
                        }

                        cells.push({
                            id: cellId,
                            text:
                                cell.textContent
                                    ?.replace(/\s+/g, ' ')
                                    .trim() ?? '',
                            colspan,
                            rowspan,
                            stage,
                            sprite
                        });

                        cellId += 1;
                    }

                    if (cells.length > 0) {
                        rows.push(cells);
                    }
                }

                if (rows.length > 0) {
                    result.push({ rows });
                }
            }

            return result;
        });

        if (tables.length === 0) {
            throw new Error(
                `No evolution tables found at ${URL}. Bulbapedia may have served a Cloudflare challenge instead of the page.`
            );
        }

        return tables;
    } finally {
        await browser.close();
    }
};

const expandRows = (table: RawTable): RawCell[][] => {
    const spans = new Map<
        number,
        {
            cell: RawCell;
            remaining: number;
        }
    >();

    const grid: RawCell[][] = [];

    for (const row of table.rows) {
        const opened = new Map<
            number,
            {
                cell: RawCell;
                remaining: number;
            }
        >();

        const columns: RawCell[] = [];

        let column = 0;
        let index = 0;

        while (
            index < row.length ||
            spans.has(column)
        ) {
            const carried = spans.get(column);

            if (carried) {
                columns[column] = carried.cell;
                column += 1;
                continue;
            }

            const cell = row[index];
            index += 1;

            const colspan = cell.colspan;
            const rowspan = cell.rowspan;

            for (
                let offset = 0;
                offset < colspan;
                offset += 1
            ) {
                columns[column] = cell;

                if (rowspan > 1) {
                    opened.set(column, {
                        cell,
                        remaining: rowspan - 1
                    });
                }

                column += 1;
            }
        }

        for (const [key, span] of spans) {
            span.remaining -= 1;

            if (span.remaining <= 0) {
                spans.delete(key);
            }
        }

        for (const [key, span] of opened) {
            spans.set(key, span);
        }

        if (columns.length > 0) {
            grid.push(columns);
        }
    }

    return grid;
};

const scrapeEvolutionLines = async (): Promise<EvolutionStage[][]> => {
    const tables = await scrapeEvolutionTables();

    const scrapedLines: EvolutionStage[][] = [];

    for (const table of tables) {
        for (const columns of expandRows(table)) {
            const stages: EvolutionStage[] = [];

            let previousCellId: number | null = null;

            for (
                let column = 0;
                column < columns.length;
                column += 1
            ) {
                const cell = columns[column];

                if (cell.id === previousCellId) {
                    continue;
                }

                previousCellId = cell.id;

                if (cell.stage) {
                    stages.push(cell.stage);
                }
            }

            if (stages.length > 1) {
                scrapedLines.push(stages);
            }
        }
    }

    return scrapedLines;
};

const buildEvolutionRecords = (
    lines: EvolutionStage[][]
): EvolutionRecord[] => {
    const records = new Map<string, EvolutionRecord>();

    const recordFor = (
        stage: EvolutionStage
    ): EvolutionRecord => {
        const key = `${stage.id}|${stage.variant ?? ''}`;

        const existing = records.get(key);

        if (existing) {
            return existing;
        }

        const record: EvolutionRecord = {
            id: stage.id,
            name: stage.name,
            variant: stage.variant,
            evolvedFrom: null,
            evolvedFromVariant: null,
            evolvesTo: []
        };

        records.set(key, record);

        return record;
    };

    for (const line of lines) {
        for (const [index, stage] of line.entries()) {
            const record = recordFor(stage);
            const next = line[index + 1];

            if (!next) {
                continue;
            }

            const alreadyLinked = record.evolvesTo.some(
                (evolution) =>
                    evolution.id === next.id &&
                    (evolution.form ?? null) === next.variant
            );

            if (!alreadyLinked) {
                record.evolvesTo.push(
                    next.variant
                        ? {
                            id: next.id,
                            form: next.variant
                        }
                        : {
                            id: next.id
                        }
                );
            }

            const target = recordFor(next);

            if (target.evolvedFrom === null) {
                target.evolvedFrom = stage.id;
                target.evolvedFromVariant = stage.variant;
            } else if (target.evolvedFrom === stage.id) {
                if (
                    target.evolvedFromVariant !==
                    stage.variant
                ) {
                    target.evolvedFromVariant = null;
                }
            } else {
                console.warn(
                    `  #${next.id} ${next.name} has two parents (#${target.evolvedFrom} and #${stage.id}); keeping the first`
                );
            }
        }
    }

    return [...records.values()];
};

const printEvolutionRecords = (
    records: EvolutionRecord[]
) => {
    const names = new Map<string, string>();

    for (const record of records) {
        names.set(
            `${record.id}|${record.variant ?? ''}`,
            record.name
        );

        names.set(`${record.id}`, record.name);
    }

    const describe = (
        id: number,
        variant: string | null | undefined
    ) => {
        const name =
            names.get(`${id}|${variant ?? ''}`) ??
            names.get(`${id}`) ??
            '?';

        return `#${String(id).padStart(4, '0')} ${name}${
            variant ? ` (${variant})` : ''
        }`;
    };

    const sorted = [...records].sort(
        (a, b) =>
            a.id - b.id ||
            (a.variant ?? '').localeCompare(
                b.variant ?? ''
            )
    );

    for (const record of sorted) {
        const from =
            record.evolvedFrom === null
                ? '—'
                : describe(
                    record.evolvedFrom,
                    record.evolvedFromVariant
                );

        const to =
            record.evolvesTo.length === 0
                ? '—'
                : record.evolvesTo
                    .map((evolution) =>
                        describe(
                            evolution.id,
                            evolution.form
                        )
                    )
                    .join(', ');

        console.log(
            `  ${describe(record.id, record.variant).padEnd(32)} from ${from.padEnd(30)} to ${to}`
        );
    }
};

const updatePokemonEvolutions = (
    pokemon: Pokemon[],
    records: EvolutionRecord[]
) => {
    const pokemonById = new Map(
        pokemon.map((currentPokemon) => [
            currentPokemon.id,
            currentPokemon
        ])
    );

    // Equivalent to the old clearEvolutions().
    for (const currentPokemon of pokemon) {
        delete currentPokemon.evolvedFrom;
        delete currentPokemon.evolvesTo;
    }

    for (const record of records) {
        const currentPokemon = pokemonById.get(record.id);

        if (!currentPokemon) {
            console.warn(
                `  Skipping #${record.id} ${record.name}: not in pokemon.json`
            );
            continue;
        }

        if (record.evolvedFrom !== null) {
            currentPokemon.evolvedFrom = {
                id: record.evolvedFrom
            };

            if (record.evolvedFromVariant) {
                currentPokemon.evolvedFrom.form =
                    record.evolvedFromVariant;
            }
        }

        if (record.evolvesTo.length > 0) {
            currentPokemon.evolvesTo =
                record.evolvesTo.map((evolution) =>
                    evolution.form
                        ? {
                            id: evolution.id,
                            form: evolution.form
                        }
                        : {
                            id: evolution.id
                        }
                );
        }
    }
};

const scrapeEvolutions = async () => {
    const lines = await scrapeEvolutionLines();
    const records = buildEvolutionRecords(lines);

    console.log(
        `Scraped ${lines.length} evolutionary lines covering ${records.length} Pokémon forms.`
    );

    if (DRY_RUN) {
        printEvolutionRecords(records);

        const withParent = records.filter(
            (record) => record.evolvedFrom !== null
        ).length;

        const withChildren = records.filter(
            (record) => record.evolvesTo.length > 0
        ).length;

        const withVariant = records.filter(
            (record) => record.variant !== null
        ).length;

        console.log(
            '\nDry run: nothing was read from or written to pokemon.json.'
        );

        console.log(
            `  ${records.length} evolution records were scraped`
        );

        console.log(
            `  ${withParent} have an evolvedFrom, ${withChildren} have an evolvesTo, ${withVariant} are a variant form`
        );

        if (records[0]) {
            console.log(
                `\nSample record: ${JSON.stringify(records[0])}`
            );
        }

        return;
    }

    const fileContents = await readFile(
        DATA_FILE,
        'utf-8'
    );

    const pokemon: Pokemon[] = JSON.parse(fileContents);

    console.log(
        `Found ${pokemon.length} Pokémon in JSON.`
    );

    updatePokemonEvolutions(pokemon, records);

    await writeFile(
        DATA_FILE,
        JSON.stringify(pokemon, null, 2),
        'utf-8'
    );

    console.log(
        `Updated evolution data in ${DATA_FILE}`
    );
};

await scrapeEvolutions();
