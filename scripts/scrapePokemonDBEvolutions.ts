import {
    readFile,
    writeFile
} from 'node:fs/promises';

import path from 'node:path';

import {
    fileURLToPath
} from 'node:url';

import {
    load,
    type CheerioAPI
} from 'cheerio';

import type {
    Element
} from 'domhandler';

import type {
    Pokemon,
    PokemonEvolution
} from '../src/lib/types';

const SOURCE_URL =
    'https://pokemondb.net/evolution';

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const DATA_FILE =
    path.resolve(
        __dirname,
        '../src/data/pokemon.json'
    );

const USER_AGENT =
    'Mozilla/5.0 (X11; Linux x86_64) ' +
    'AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) ' +
    'Chrome/124.0 Safari/537.36';

type EvolutionForm =
    | 'alola'
    | 'galar'
    | 'hisui'
    | 'paldea'
    | 'mega'
    | 'gigantamax'
    | 'totem'
    | 'origin'
    | 'sky'
    | 'east'
    | 'west'
    | 'midday'
    | 'midnight'
    | 'dusk'
    | 'amped'
    | 'low-key'
    | 'ice'
    | 'full-belly'
    | 'hangry'
    | 'red-striped'
    | 'blue-striped'
    | 'white-striped';

type ScrapedPokemon = {
    key: string;
    name: string;
    form?: EvolutionForm;
};

type EvolutionEdge = {
    from: ScrapedPokemon;
    to: ScrapedPokemon;
};

/**
 * Regional/form words that may appear in PokémonDB's
 * evolution-card text.
 */
const FORM_PATTERNS: Array<{
    pattern: RegExp;
    form: EvolutionForm;
}> = [
    {
        pattern: /\balolan\b|\balola\b/i,
        form: 'alola'
    },
    {
        pattern: /\bgalarian\b|\bgalar\b/i,
        form: 'galar'
    },
    {
        pattern: /\bhisuian\b|\bhisui\b/i,
        form: 'hisui'
    },
    {
        pattern: /\bpaldean\b|\bpaldea\b/i,
        form: 'paldea'
    },
    {
        pattern: /\bmega\b/i,
        form: 'mega'
    },
    {
        pattern: /\bgigantamax\b/i,
        form: 'gigantamax'
    },
    {
        pattern: /\btotem\b/i,
        form: 'totem'
    },
    {
        pattern: /\borigin\b/i,
        form: 'origin'
    },
    {
        pattern: /\bsky form\b|\bsky\b/i,
        form: 'sky'
    },
    {
        pattern: /\beast form\b|\beast\b/i,
        form: 'east'
    },
    {
        pattern: /\bwest form\b|\bwest\b/i,
        form: 'west'
    },
    {
        pattern: /\bmidday form\b|\bmidday\b/i,
        form: 'midday'
    },
    {
        pattern: /\bmidnight form\b|\bmidnight\b/i,
        form: 'midnight'
    },
    {
        pattern: /\bdusk form\b|\bdusk\b/i,
        form: 'dusk'
    },
    {
        pattern: /\bamped form\b|\bamped\b/i,
        form: 'amped'
    },
    {
        pattern: /\blow key form\b|\blow key\b|\blow-key\b/i,
        form: 'low-key'
    },
    {
        pattern: /\bice face\b/i,
        form: 'ice'
    },
    {
        pattern: /\bfull belly\b/i,
        form: 'full-belly'
    },
    {
        pattern: /\bhungry mode\b|\bhangry\b/i,
        form: 'hangry'
    },
    {
        pattern: /\bred-striped\b|\bred striped\b/i,
        form: 'red-striped'
    },
    {
        pattern: /\bblue-striped\b|\bblue striped\b/i,
        form: 'blue-striped'
    },
    {
        pattern: /\bwhite-striped\b|\bwhite striped\b/i,
        form: 'white-striped'
    }
];

const canonicalKey = (
    name: string
): string => {
    let value =
        name
            .toLowerCase()
            .trim();

    value =
        value
            .replace(/♀/g, '-f')
            .replace(/♂/g, '-m')
            .replace(/’/g, "'");

    value =
        value.replace(
            /\s*\(.*?\)\s*/g,
            ' '
        );

    value =
        value.replace(
            /[^a-z0-9]+/g,
            '-'
        );

    return value.replace(
        /^-+|-+$/g,
        ''
    );
};

const keyFromHref = (
    href: string
): string | null => {
    const cleanHref =
        href.split('?')[0];

    const parts =
        cleanHref
            .split('/')
            .filter(Boolean);

    const slug =
        parts.at(-1);

    if (!slug) {
        return null;
    }

    return canonicalKey(
        slug
    );
};

const detectForm = (
    text: string
): EvolutionForm | undefined => {
    for (
        const {
            pattern,
            form
        } of FORM_PATTERNS
    ) {
        if (
            pattern.test(text)
        ) {
            return form;
        }
    }

    return undefined;
};

const removeFormWords = (
    name: string
): string => {
    let value =
        name.trim();

    value =
        value.replace(
            /^(Alolan|Galarian|Hisuian|Paldean)\s+/i,
            ''
        );

    value =
        value.replace(
            /\s+(Form|Mode)$/i,
            ''
        );

    return value;
};

const extractPokemonFromCard = (
    $: CheerioAPI,
    card: Element
): ScrapedPokemon | null => {
    const anchor =
        $(card)
            .find('a.ent-name')
            .first();

    if (
        anchor.length === 0
    ) {
        return null;
    }

    const href =
        anchor.attr('href');

    const anchorName =
        anchor
            .text()
            .replace(/\s+/g, ' ')
            .trim();

    if (
        !href ||
        !anchorName
    ) {
        return null;
    }

    const hrefKey =
        keyFromHref(href);

    const cardText =
        $(card)
            .text()
            .replace(/\s+/g, ' ')
            .trim();

    const form =
        detectForm(
            cardText
        );

    const key =
        hrefKey ??
        canonicalKey(
            removeFormWords(
                anchorName
            )
        );

    return {
        key,
        name: anchorName,
        form
    };
};

const parseEvolutionPage = (
    html: string
): EvolutionEdge[] => {
    const $ =
        load(html);

    const edges: EvolutionEdge[] =
        [];

    const edgeKeys =
        new Set<string>();

    $('.infocard-list-evo').each(
        (
            _index,
            chain
        ) => {
            const cards =
                $(chain).find(
                    '.infocard'
                );

            const pokemon: ScrapedPokemon[] =
                [];

            cards.each(
                (
                    _cardIndex,
                    card
                ) => {
                    const value =
                        extractPokemonFromCard(
                            $,
                            card
                        );

                    if (
                        value
                    ) {
                        pokemon.push(
                            value
                        );
                    }
                }
            );

            if (
                pokemon.length < 2
            ) {
                return;
            }

            for (
                let i = 0;
                i <
                pokemon.length - 1;
                i++
            ) {
                const from =
                    pokemon[i];

                const to =
                    pokemon[i + 1];

                const edgeKey =
                    [
                        from.key,
                        from.form ?? '',
                        to.key,
                        to.form ?? ''
                    ].join('|');

                if (
                    edgeKeys.has(
                        edgeKey
                    )
                ) {
                    continue;
                }

                edgeKeys.add(
                    edgeKey
                );

                edges.push({
                    from,
                    to
                });
            }
        }
    );

    return edges;
};

const fetchEvolutionPage =
    async (): Promise<string> => {
        console.log(
            `Fetching ${SOURCE_URL}...`
        );

        const response =
            await fetch(
                SOURCE_URL,
                {
                    headers: {
                        'User-Agent':
                            USER_AGENT,
                        Accept:
                            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language':
                            'en-US,en;q=0.9',
                        Referer:
                            'https://pokemondb.net/'
                    }
                }
            );

        if (
            !response.ok
        ) {
            throw new Error(
                `PokémonDB returned HTTP ${response.status} ${response.statusText}`
            );
        }

        const html =
            await response.text();

        if (
            html.length < 5000
        ) {
            throw new Error(
                `PokémonDB returned an unexpectedly small page (${html.length} characters)`
            );
        }

        return html;
    };

const validatePage = (
    html: string
): void => {
    const lower =
        html.toLowerCase();

    const requiredIndicators = [
        'evolution',
        'pokemon',
        'evolutionary'
    ];

    for (
        const indicator of
        requiredIndicators
    ) {
        if (
            !lower.includes(
                indicator
            )
        ) {
            throw new Error(
                `Evolution page is missing expected content: "${indicator}"`
            );
        }
    }

    if (
        !lower.includes(
            'infocard-list-evo'
        )
    ) {
        console.log(
            '  ⚠️ Could not verify the evolution-card class in raw HTML.'
        );
    }
};

const readPokemon =
    async (): Promise<Pokemon[]> => {
        console.log(
            `Reading ${DATA_FILE}...`
        );

        const json =
            await readFile(
                DATA_FILE,
                'utf-8'
            );

        const pokemon =
            JSON.parse(
                json
            ) as Pokemon[];

        if (
            !Array.isArray(
                pokemon
            )
        ) {
            throw new Error(
                'pokemon.json does not contain an array.'
            );
        }

        return pokemon;
    };

const buildPokemonLookup = (
    pokemon: Pokemon[]
): Map<string, Pokemon> => {
    const lookup =
        new Map<
            string,
            Pokemon
        >();

    for (
        const entry of
        pokemon
    ) {
        const key =
            canonicalKey(
                entry.name
            );

        lookup.set(
            key,
            entry
        );

        if (
            key ===
            'nidoran-f'
        ) {
            lookup.set(
                'nidoran-female',
                entry
            );
        }

        if (
            key ===
            'nidoran-m'
        ) {
            lookup.set(
                'nidoran-male',
                entry
            );
        }
    }

    return lookup;
};

const resolvePokemon = (
    scraped: ScrapedPokemon,
    lookup: Map<
        string,
        Pokemon
    >
): Pokemon | undefined => {
    const direct =
        lookup.get(
            scraped.key
        );

    if (
        direct
    ) {
        return direct;
    }

    const baseName =
        removeFormWords(
            scraped.name
        );

    return lookup.get(
        canonicalKey(
            baseName
        )
    );
};

const evolutionKey = (
    evolution: PokemonEvolution
): string => {
    return [
        evolution.id,
        evolution.form ?? ''
    ].join('|');
};

const sameEvolution = (
    a: PokemonEvolution | undefined,
    b: PokemonEvolution | undefined
): boolean => {
    return (
        a?.id === b?.id &&
        a?.form === b?.form
    );
};

const sameEvolutionArray = (
    a:
        | PokemonEvolution[]
        | undefined,
    b:
        | PokemonEvolution[]
        | undefined
): boolean => {
    const left =
        a ?? [];

    const right =
        b ?? [];

    if (
        left.length !==
        right.length
    ) {
        return false;
    }

    for (
        let i = 0;
        i < left.length;
        i++
    ) {
        if (
            !sameEvolution(
                left[i],
                right[i]
            )
        ) {
            return false;
        }
    }

    return true;
};

const addEvolution = (
    map: Map<
        number,
        PokemonEvolution[]
    >,
    pokemonId: number,
    evolution: PokemonEvolution
): void => {
    const existing =
        map.get(
            pokemonId
        ) ?? [];

    const key =
        evolutionKey(
            evolution
        );

    if (
        !existing.some(
            (
                item
            ) =>
                evolutionKey(
                    item
                ) === key
        )
    ) {
        existing.push(
            evolution
        );
    }

    map.set(
        pokemonId,
        existing
    );
};

const sortEvolutionArray = (
    values: PokemonEvolution[]
): PokemonEvolution[] => {
    return values.sort(
        (a, b) => {
            if (
                a.id !== b.id
            ) {
                return a.id - b.id;
            }

            return (
                (a.form ?? '')
                    .localeCompare(
                        b.form ?? ''
                    )
            );
        }
    );
};

const buildEvolutionRelationships = (
    pokemon: Pokemon[],
    scrapedEdges: EvolutionEdge[]
): {
    evolvedFrom: Map<
        number,
        PokemonEvolution[]
    >;
    evolvesTo: Map<
        number,
        PokemonEvolution[]
    >;
    unresolved: EvolutionEdge[];
} => {
    const lookup =
        buildPokemonLookup(
            pokemon
        );

    const evolvedFrom =
        new Map<
            number,
            PokemonEvolution[]
        >();

    const evolvesTo =
        new Map<
            number,
            PokemonEvolution[]
        >();

    const unresolved: EvolutionEdge[] =
        [];

    for (
        const edge of
        scrapedEdges
    ) {
        const fromPokemon =
            resolvePokemon(
                edge.from,
                lookup
            );

        const toPokemon =
            resolvePokemon(
                edge.to,
                lookup
            );

        if (
            !fromPokemon ||
            !toPokemon
        ) {
            unresolved.push(
                edge
            );

            continue;
        }

        const form =
            edge.from.form ??
            edge.to.form;

        const evolution:
            PokemonEvolution =
            form
                ? {
                    id: toPokemon.id,
                    form
                }
                : {
                    id: toPokemon.id
                };

        addEvolution(
            evolvesTo,
            fromPokemon.id,
            evolution
        );

        const reverseEvolution:
            PokemonEvolution =
            form
                ? {
                    id: fromPokemon.id,
                    form
                }
                : {
                    id: fromPokemon.id
                };

        addEvolution(
            evolvedFrom,
            toPokemon.id,
            reverseEvolution
        );
    }

    for (
        const [
            id,
            values
        ] of evolvesTo
    ) {
        sortEvolutionArray(
            values
        );

        evolvesTo.set(
            id,
            values
        );
    }

    for (
        const [
            id,
            values
        ] of evolvedFrom
    ) {
        sortEvolutionArray(
            values
        );

        evolvedFrom.set(
            id,
            values
        );
    }

    return {
        evolvedFrom,
        evolvesTo,
        unresolved
    };
};

const validateRelationships = (
    pokemon: Pokemon[],
    evolvedFrom: Map<
        number,
        PokemonEvolution[]
    >,
    evolvesTo: Map<
        number,
        PokemonEvolution[]
    >
): void => {
    const byId =
        new Map<
            number,
            Pokemon
        >(
            pokemon.map(
                (entry) => [
                    entry.id,
                    entry
                ]
            )
        );

    console.log(
        '  🔍 Running evolution sanity checks...'
    );

    const eevee =
        pokemon.find(
            (entry) =>
                entry.name ===
                'Eevee'
        );

    if (
        eevee
    ) {
        const eeveeEvolutions =
            evolvesTo.get(
                eevee.id
            ) ?? [];

        if (
            eeveeEvolutions.length <
            2
        ) {
            throw new Error(
                `Eevee sanity check failed: expected multiple evolutions, found ${eeveeEvolutions.length}.`
            );
        }

        console.log(
            `    ✅ Eevee has ${eeveeEvolutions.length} evolution targets`
        );
    }

    const nidoranFemale =
        pokemon.find(
            (entry) =>
                entry.name ===
                'Nidoran♀'
        );

    const nidoranMale =
        pokemon.find(
            (entry) =>
                entry.name ===
                'Nidoran♂'
        );

    if (
        nidoranFemale &&
        nidoranMale
    ) {
        const femaleTargets =
            evolvesTo.get(
                nidoranFemale.id
            ) ?? [];

        const maleTargets =
            evolvesTo.get(
                nidoranMale.id
            ) ?? [];

        if (
            femaleTargets.length ===
            0
        ) {
            throw new Error(
                'Nidoran♀ sanity check failed: no evolution target found.'
            );
        }

        if (
            maleTargets.length ===
            0
        ) {
            throw new Error(
                'Nidoran♂ sanity check failed: no evolution target found.'
            );
        }

        console.log(
            '    ✅ Nidoran♀ and Nidoran♂ have separate evolution paths'
        );
    }

    const vulpix =
        pokemon.find(
            (entry) =>
                entry.name ===
                'Vulpix'
        );

    if (
        vulpix
    ) {
        const targets =
            evolvesTo.get(
                vulpix.id
            ) ?? [];

        const hasVulpixEvolution =
            targets.some(
                (target) =>
                    byId.has(
                        target.id
                    )
            );

        if (
            !hasVulpixEvolution
        ) {
            throw new Error(
                'Vulpix sanity check failed: no evolution target resolved.'
            );
        }

        console.log(
            '    ✅ Vulpix regional-form data resolves to the existing Vulpix record'
        );
    }

    const mrMime =
        pokemon.find(
            (entry) =>
                entry.name ===
                'Mr. Mime'
        );

    const mrRime =
        pokemon.find(
            (entry) =>
                entry.name ===
                'Mr. Rime'
        );

    if (
        mrMime &&
        mrRime
    ) {
        const targets =
            evolvesTo.get(
                mrMime.id
            ) ?? [];

        const mrRimeEvolution =
            targets.find(
                (target) =>
                    target.id ===
                    mrRime.id &&
                    target.form ===
                    'galar'
            );

        if (
            !mrRimeEvolution
        ) {
            throw new Error(
                'Mr. Mime sanity check failed: Mr. Rime was not found as a Galar evolution target.'
            );
        }

        console.log(
            '    ✅ Mr. Mime → Mr. Rime preserves form "galar"'
        );

        const reverse =
            evolvedFrom.get(
                mrRime.id
            ) ?? [];

        const mrMimeReverse =
            reverse.some(
                (evolution) =>
                    evolution.id ===
                        mrMime.id &&
                    evolution.form ===
                        'galar'
            );

        if (
            !mrMimeReverse
        ) {
            throw new Error(
                'Mr. Rime sanity check failed: evolvedFrom does not preserve form "galar".'
            );
        }

        console.log(
            '    ✅ Mr. Rime → evolvedFrom preserves form "galar"'
        );
    }
};

const scrapePokemonDBEvolutions =
    async (): Promise<void> => {
        const dryRun =
            process.argv.includes(
                '--dry-run'
            );

        const unknownArguments =
            process.argv.filter(
                (
                    argument
                ) =>
                    argument !==
                        '--dry-run' &&
                    argument !==
                        process.argv[0] &&
                    argument !==
                        process.argv[1]
            );

        if (
            unknownArguments.length >
            0
        ) {
            throw new Error(
                'Unknown argument. The only supported option is --dry-run.'
            );
        }

        console.log(
            '========================================'
        );

        console.log(
            'Pokémon Evolution Scraper'
        );

        console.log(
            '========================================'
        );

        if (
            dryRun
        ) {
            console.log(
                '🧪 DRY RUN — pokemon.json will NOT be modified.'
            );
        } else {
            console.log(
                '✏️ Normal run — pokemon.json WILL be updated.'
            );
        }

        console.log('');

        const html =
            await fetchEvolutionPage();

        console.log(
            `  Downloaded ${html.length.toLocaleString()} characters.`
        );

        console.log(
            '  🧪 Validating source page...'
        );

        validatePage(
            html
        );

        console.log(
            '    ✅ Source page passed validation.'
        );

        console.log(
            '  🔍 Parsing evolution relationships...'
        );

        const scrapedEdges =
            parseEvolutionPage(
                html
            );

        if (
            scrapedEdges.length ===
            0
        ) {
            throw new Error(
                'No evolution relationships were parsed.'
            );
        }

        console.log(
            `    Found ${scrapedEdges.length} evolution relationships.`
        );

        const pokemon =
            await readPokemon();

        console.log(
            `    Loaded ${pokemon.length} Pokémon records.`
        );

        const {
            evolvedFrom,
            evolvesTo,
            unresolved
        } =
            buildEvolutionRelationships(
                pokemon,
                scrapedEdges
            );

        if (
            unresolved.length > 0
        ) {
            console.log('');
            console.log(
                `  ⚠️ ${unresolved.length} evolution relationships could not be resolved to pokemon.json:`
            );

            for (
                const edge of
                unresolved
            ) {
                console.log(
                    `    ${edge.from.name}` +
                    `${edge.from.form ? ` [${edge.from.form}]` : ''}` +
                    ` → ${edge.to.name}` +
                    `${edge.to.form ? ` [${edge.to.form}]` : ''}`
                );
            }

            console.log('');
        }

        validateRelationships(
            pokemon,
            evolvedFrom,
            evolvesTo
        );

        let updated = 0;
        let unchanged = 0;
        let withEvolutionData = 0;

        for (
            const entry of
            pokemon
        ) {
            const nextEvolvedFrom =
                evolvedFrom.get(
                    entry.id
                );

            const nextEvolvesTo =
                evolvesTo.get(
                    entry.id
                );

            if (
                nextEvolvedFrom ||
                nextEvolvesTo
            ) {
                withEvolutionData++;
            }

            const previousEvolvedFrom =
                entry.evolvedFrom;

            const previousEvolvesTo =
                entry.evolvesTo;

            const fromSame =
                sameEvolutionArray(
                    previousEvolvedFrom,
                    nextEvolvedFrom
                );

            const toSame =
                sameEvolutionArray(
                    previousEvolvesTo,
                    nextEvolvesTo
                );

            if (
                fromSame &&
                toSame
            ) {
                unchanged++;
                continue;
            }

            updated++;

            console.log(
                `  ${entry.name}:`
            );

            if (
                nextEvolvedFrom &&
                nextEvolvedFrom.length >
                    0
            ) {
                for (
                    const evolution of
                    nextEvolvedFrom
                ) {
                    const parent =
                        pokemon.find(
                            (
                                candidate
                            ) =>
                                candidate.id ===
                                evolution.id
                        );

                    console.log(
                        `    ← ${parent?.name ??
                            `#${evolution.id}`}` +
                        `${evolution.form
                            ? ` [${evolution.form}]`
                            : ''
                        }`
                    );
                }
            } else {
                console.log(
                    '    ← none'
                );
            }

            if (
                nextEvolvesTo &&
                nextEvolvesTo.length >
                    0
            ) {
                for (
                    const evolution of
                    nextEvolvesTo
                ) {
                    const child =
                        pokemon.find(
                            (
                                candidate
                            ) =>
                                candidate.id ===
                                evolution.id
                        );

                    console.log(
                        `    → ${child?.name ??
                            `#${evolution.id}`}` +
                        `${evolution.form
                            ? ` [${evolution.form}]`
                            : ''
                        }`
                    );
                }
            } else {
                console.log(
                    '    → none'
                );
            }

            if (
                !dryRun
            ) {
                if (
                    nextEvolvedFrom &&
                    nextEvolvedFrom.length >
                        0
                ) {
                    entry.evolvedFrom =
                        nextEvolvedFrom;
                } else {
                    delete entry.evolvedFrom;
                }

                if (
                    nextEvolvesTo &&
                    nextEvolvesTo.length >
                        0
                ) {
                    entry.evolvesTo =
                        nextEvolvesTo;
                } else {
                    delete entry.evolvesTo;
                }
            }
        }

        if (
            dryRun
        ) {
            console.log('');
            console.log(
                '🧪 Dry run complete.'
            );

            console.log(
                '   No changes were written to pokemon.json.'
            );
        } else {
            await writeFile(
                DATA_FILE,
                JSON.stringify(
                    pokemon,
                    null,
                    2
                ),
                'utf-8'
            );

            console.log('');
            console.log(
                `💾 Wrote updated data to ${DATA_FILE}`
            );
        }

        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            'Evolution scrape complete'
        );

        console.log(
            '========================================'
        );

        console.log(
            `Evolution edges:        ${scrapedEdges.length}`
        );

        console.log(
            `Resolved relationships: ${withEvolutionData}`
        );

        console.log(
            `Changed records:        ${updated}`
        );

        console.log(
            `Unchanged records:      ${unchanged}`
        );

        console.log(
            `Unresolved edges:       ${unresolved.length}`
        );

        console.log(
            `Total Pokémon:          ${pokemon.length}`
        );

        console.log(
            `Mode:                   ${
                dryRun
                    ? 'DRY RUN'
                    : 'WRITE'
            }`
        );

        console.log('');
    };

scrapePokemonDBEvolutions().catch(
    (error) => {
        console.error('');
        console.error(
            '❌ Evolution scraper failed:'
        );
        console.error(
            error
        );

        process.exit(1);
    }
);
