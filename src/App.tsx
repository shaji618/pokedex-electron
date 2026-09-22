import React from 'react';
import { Box } from '@mui/material';
import {
    BrowserRouter,
    Routes,
    Route
} from 'react-router-dom';

import MainMenu from './components/MainMenu';
import IdCard from './components/IdCard/IdCard';
import WhosThatPokemon from './components/WhosThatPokemon/WhosThatPokemon';
import { AppRoutes } from './lib/types';

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <Box
                sx={{
                    width: '100%',
                    height: '95vh',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'purple'
                }}
            >
                <Routes>
                    <Route
                        path="/"
                        element={<MainMenu />}
                    />

                    <Route
                        path={AppRoutes.ID_CARD}
                        element={<IdCard />}
                    />
                    <Route
                        path={AppRoutes.WHOS_THAT_POKEMON}
                        element={<WhosThatPokemon />}
                    />
                </Routes>
            </Box>
        </BrowserRouter>
    );
};

export default App;
