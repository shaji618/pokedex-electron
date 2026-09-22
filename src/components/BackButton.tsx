import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';

const BackButton: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Button
            variant="contained"
            onClick={() => navigate(-1)}
            sx={{ mt: 2, width: '100%' }}
        >
            Back
        </Button>
    );
};

export default BackButton;
