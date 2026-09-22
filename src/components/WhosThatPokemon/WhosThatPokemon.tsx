import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';
import { Box, Typography } from '@mui/material';

import backgroundImage from './assets/background.png';
import BackButton from '../BackButton';
import {
    getCryForPokemon,
    getImageForPokemon,
    getNameImageForPokemon,
    getRandomPokemon
} from '../../lib/helpers';
import type { Pokemon } from '../../lib/types';
import introMusic from './assets/whos_that_pokemon.mp3';

type GamePhase = 0 | 1 | 2;

const FADE_OUT_DURATION = 800;

const WhosThatPokemon: React.FC = () => {
    const [pokemon, setPokemon] = useState<Pokemon>(() =>
        getRandomPokemon()
    );
    const [phase, setPhase] = useState<GamePhase>(0);

    const introAudio = useRef<HTMLAudioElement | null>(null);
    const cryAudio = useRef<HTMLAudioElement | null>(null);
    const fadeTimeout = useRef<number | null>(null);

    const image = getImageForPokemon({
        id: pokemon.id
    });

    const nameImage = getNameImageForPokemon({
        id: pokemon.id
    });

    const cry = getCryForPokemon({
        id: pokemon.id
    });

    const stopAudio = useCallback(
        (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
            audioRef.current?.pause();

            if (audioRef.current) {
                audioRef.current.currentTime = 0;
            }

            audioRef.current = null;
        },
        []
    );

    const fadeOutIntroMusic = useCallback(() => {
        const audio = introAudio.current;

        if (!audio) {
            return;
        }

        if (fadeTimeout.current !== null) {
            window.clearTimeout(fadeTimeout.current);
            fadeTimeout.current = null;
        }

        const startVolume = audio.volume;
        const startTime = performance.now();

        const fade = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(
                elapsed / FADE_OUT_DURATION,
                1
            );

            audio.volume = startVolume * (1 - progress);

            if (progress < 1) {
                fadeTimeout.current = window.requestAnimationFrame(fade);
                return;
            }

            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0.6;

            if (introAudio.current === audio) {
                introAudio.current = null;
            }

            fadeTimeout.current = null;
        };

        fadeTimeout.current = window.requestAnimationFrame(fade);
    }, []);

    const startIntroMusic = useCallback(() => {
        if (introAudio.current) {
            stopAudio(introAudio);
        }

        const audio = new Audio(introMusic);
        audio.volume = 0.6;
        audio.loop = false;
        introAudio.current = audio;

        void audio.play().catch((error: unknown) => {
            if (
                error instanceof DOMException &&
                error.name === 'AbortError'
            ) {
                return;
            }

            console.error(
                'Failed to play intro music:',
                error
            );
        });
    }, [stopAudio]);

    const playCry = useCallback(() => {
        if (!cry) {
            console.warn(
                `No cry found for ${pokemon.name} (#${pokemon.id})`
            );
            return;
        }

        stopAudio(cryAudio);

        const audio = new Audio(cry);
        audio.volume = 1;
        audio.loop = false;

        cryAudio.current = audio;

        void audio.play().catch((error: unknown) => {
            if (
                error instanceof DOMException &&
                error.name === 'AbortError'
            ) {
                return;
            }

            console.error(
                `Failed to play cry for ${pokemon.name}:`,
                error
            );
        });
    }, [cry, pokemon.id, pokemon.name, stopAudio]);

    const advanceGame = useCallback(() => {
        if (phase === 0) {
            setPhase(1);
            return;
        }

        if (phase === 1) {
            setPhase(2);
            fadeOutIntroMusic();
            playCry();
            return;
        }

        stopAudio(cryAudio);
        stopAudio(introAudio);

        setPokemon(getRandomPokemon());
        setPhase(0);
    }, [
        fadeOutIntroMusic,
        phase,
        playCry,
        stopAudio
    ]);

    useEffect(() => {
        startIntroMusic();

        return () => {
            if (fadeTimeout.current !== null) {
                window.cancelAnimationFrame(fadeTimeout.current);
                fadeTimeout.current = null;
            }

            stopAudio(introAudio);
            stopAudio(cryAudio);
        };
    }, [startIntroMusic, stopAudio]);

    useEffect(() => {
        if (phase === 0 && introAudio.current === null) {
            startIntroMusic();
        }
    }, [phase, pokemon.id, startIntroMusic]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.key === 'ArrowRight' ||
                event.key === 'Enter' ||
                event.key === ' '
            ) {
                event.preventDefault();
                advanceGame();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [advanceGame]);

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor:
                    phase === 2 ? 'black' : undefined,
                backgroundImage:
                    phase === 2
                        ? 'none'
                        : `url(${backgroundImage})`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: 'cover'
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    flex: 1,
                    width: '100%'
                }}
            >
                {phase === 0 && image && (
                    <Box
                        component="img"
                        src={image}
                        alt=""
                        sx={{
                            position: 'absolute',
                            left: '4%',
                            top: '8%',
                            width: '44%',
                            height: '70%',
                            objectFit: 'contain',
                            filter: 'brightness(0)'
                        }}
                    />
                )}

                {phase === 1 && image && (
                    <Box
                        component="img"
                        src={image}
                        alt={pokemon.name}
                        sx={{
                            position: 'absolute',
                            left: '4%',
                            top: '8%',
                            width: '44%',
                            height: '70%',
                            objectFit: 'contain'
                        }}
                    />
                )}

                {phase === 2 && (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        {nameImage ? (
                            <Box
                                component="img"
                                src={nameImage}
                                alt={pokemon.name}
                                sx={{
                                    maxWidth: '60%',
                                    maxHeight: '25%',
                                    objectFit: 'contain'
                                }}
                            />
                        ) : (
                            <Typography
                                variant="h1"
                                sx={{
                                    color: 'white',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {pokemon.name}
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>

            <BackButton />
        </Box>
    );
};

export default WhosThatPokemon;
