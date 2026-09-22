import React from 'react';
import {
    Avatar,
    Box,
    Stack,
    Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

import trainerHeader from './assets/trainerHeader.png';
import ali from './assets/ali2.jpg';
import zz from './assets/zz.jpg';
import signature from './assets/signature.jpg';
import BackButton from '../BackButton';
import { AppRoutes } from '../../lib/types';
import { getImageForPokemon } from '../../lib/helpers';

interface BioData {
    photo: string;
    name: string;
    birthday: string;
    favoritePokemon: string;
    favoriteColor: string;
    signature: string;
}

interface IdCardProps {
    character?: 'ali' | 'zz';
    showBackButton?: boolean;
}

const aliData: BioData = {
    photo: ali,
    name: 'Ali',
    birthday: 'August 18, 2014',
    favoritePokemon: 'Pikachu',
    favoriteColor: 'Purple',
    signature: signature
};

const zzData: BioData = {
    photo: zz,
    name: 'ZZ',
    birthday: 'September 12, 2016',
    favoritePokemon: 'Eevee',
    favoriteColor: 'Purple',
    signature: signature
};

const calculateAge = (birthday: string): string => {
    const birthDate = new Date(birthday);
    const today = new Date();

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();

    if (
        months < 0 ||
        (months === 0 && today.getDate() < birthDate.getDate())
    ) {
        years--;
        months += 12;
    }

    return `${years} years, ${months} month${months === 1 ? '' : 's'}`;
};

export const IdCardPreview: React.FC<{ character: 'ali' | 'zz' }> = ({ character }) => {
    const navigate = useNavigate();

    return (
        <Box
            onClick={() => navigate(AppRoutes.ID_CARD)}
            sx={{
                width: 'clamp(180px, 32vw, 220px)',
                aspectRatio: '1.6 / 1',
                flexShrink: 1,
                minWidth: 0,
                mt: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                mx: { xs: 1, sm: 2 },
                overflow: 'hidden',
                cursor: 'pointer'
            }}
        >
            <Box
                sx={{
                    width: '200%',
                    height: '200%',
                    flexShrink: 0,

                    transform: 'scale(0.35)',
                    transformOrigin: 'top center'
                }}
            >
                <IdCard character={character} showBackButton={false} />
            </Box>
        </Box>
    );
};

const IdCard: React.FC<IdCardProps> = ({ character, showBackButton = true }) => {
    const data = character === 'ali' ? aliData : zzData;
    const { photo, name, birthday, favoritePokemon, favoriteColor, signature } = data;

    return (
        <Stack>
            <Box
                sx={{
                    width: '100%',
                    maxWidth: '90vw',
                    mx: 'auto',
                    px: 2,
                    border: 2,
                    borderColor: 'black',
                    borderStyle: 'solid',
                    borderRadius: 2,
                    backgroundColor: 'white'
                }}
            >
                {/* Header */}
                <Box
                    component="img"
                    src={trainerHeader}
                    alt="Trainer card header"
                    sx={{
                        mt: 2,
                        width: '100%',
                        height: 'auto',
                        display: 'block'
                    }}
                />

                {/* Body */}
                <Box
                    sx={{
                        width: '100%',
                        mt: 4,
                        display: 'flex',
                        gap: 3,
                        alignItems: 'flex-start',
                        flexDirection: { xs: 'column', sm: 'row' }
                    }}
                >
                    {/* Photo */}
                    <Box
                        sx={{
                            width: { xs: '50%', sm: '25%' },
                            maxWidth: '12rem',
                            flexShrink: 0
                        }}
                    >
                        <Box
                            component="img"
                            src={photo}
                            alt="headshot"
                            sx={{
                                mb: 2,
                                width: '100%',
                                aspectRatio: '3 / 4',
                                objectFit: 'cover',
                                display: 'block',
                                border: 2,
                                borderStyle: 'solid',
                                borderRadius: 2,
                                borderColor: 'gray'
                            }}
                        />
                    </Box>

                    {/* Biodata + Signature */}
                    <Box sx={{ flex: 1 }}>
                        <Typography
                            variant="h3"
                            component="h1"
                            sx={{
                                fontWeight: 'bold',
                                lineHeight: 1.1
                            }}
                        >
                            {name}
                        </Typography>

                        <Box sx={{ mt: 2 }}>
                            <Typography>
                                <strong>Date of Birth:</strong>
                                {` ${birthday}`}
                            </Typography>

                            <Typography>
                                <strong>Age:</strong>
                                {` ${calculateAge(birthday)}`}
                            </Typography>

                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5
                                }}
                            >
                                <Typography>
                                    <strong>Favorite Pokemon:</strong>
                                    {` ${favoritePokemon}`}
                                </Typography>

                                <Avatar
                                    alt={favoritePokemon}
                                    src={getImageForPokemon({ name: favoritePokemon })}
                                />
                            </Box>

                            <Typography>
                                <strong>Favorite color:
                                    <Box
                                        component="span"
                                        sx={{ color: favoriteColor }}
                                    >
                                        {` ${favoriteColor}`}
                                    </Box>
                                </strong>
                            </Typography>
                        </Box>

                        {/* Signature */}
                        <Box
                            sx={{
                                ml: -8,
                                display: 'flex',
                                justifyContent: 'flex-start'
                            }}
                        >
                            <Box
                                component="img"
                                src={signature}
                                alt="signature"
                                sx={{
                                    width: 'clamp(100px, 40%, 180px)',
                                    height: 'auto',
                                    maxHeight: '80px',
                                    objectFit: 'contain'
                                }}
                            />
                        </Box>
                    </Box>
                </Box>
            </Box>
            {showBackButton && <BackButton />}
        </ Stack>
    );
};

export default IdCard;
