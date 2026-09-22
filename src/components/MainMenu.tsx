import React from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import camera from '../assets/camera.png';
import pechaBerry from '../assets/pecha-berry.png';
import pokeball from '../assets/pokeball.png';
import whosThatPokemon from '../assets/whos-that-pokemon.png';
import { IdCardPreview } from './IdCard/IdCard';
import { AppRoutes } from '../lib/types';

const MENU_ITEM_SIZE = 'clamp(100px, 25vw, 25vh)';

interface MenuItemProps {
    src: string;
    alt: string;
    navigateTo?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({
    src,
    alt,
    navigateTo
}) => {
    const navigate = useNavigate();
    
    return (
        <Box
            {...(navigateTo && { onClick: () => navigate(navigateTo) })}
            sx={{
                width: MENU_ITEM_SIZE,
                aspectRatio: '1 / 1',
                flexShrink: 0,
                border: 2,
                borderColor: 'gray',
                borderStyle: 'dotted',
                borderRadius: '50%',
                overflow: 'hidden',
                boxSizing: 'border-box',
                cursor: navigateTo ? 'pointer' : 'default',
                backgroundColor: 'white'
            }}
        >
            <Box
                component="img"
                src={src}
                alt={alt}
                sx={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center'
                }}
            />
        </Box>
    );
};

const MainMenu: React.FC = () => {
    return (
        <Box
            sx={{
                width: '90vw',
                height: '90vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 'clamp(1rem, 3vh, 3rem)',
                boxSizing: 'border-box'
            }}
        >
            <MenuItem
                src={camera}
                alt="scanner"
            />

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    gap: 'clamp(1rem, 4vw, 4rem)',
                    width: '100%',
                    minWidth: 0,
                    px: { xs: 1, sm: 2 },
                    boxSizing: 'border-box'
                }}
            >
                <MenuItem
                    src={pokeball}
                    alt="pokedex"
                />

                <IdCardPreview character='zz' />

                <MenuItem
                    src={pechaBerry}
                    alt="pokemon-hunt"
                />
            </Box>

            <MenuItem
                src={whosThatPokemon}
                alt="whos-that-pokemon"
                navigateTo={AppRoutes.WHOS_THAT_POKEMON}
            />
        </Box>
    );
};

export default MainMenu;
