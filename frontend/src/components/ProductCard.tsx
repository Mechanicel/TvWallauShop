// frontend/src/components/ProductCard.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../utils/constants';
import { resolveImageUrl } from '../utils/imageUrl';

type ProductCardProps = {
    id: number;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
};

export const ProductCard: React.FC<ProductCardProps> = ({
                                                            id,
                                                            name,
                                                            description,
                                                            price,
                                                            imageUrl,
                                                        }) => {
    const navigate = useNavigate();
    const imgSrc = resolveImageUrl(imageUrl);

    const handleClick = () => {
        navigate(ROUTES.PRODUCT_DETAIL(id));
    };

    return (
        <div
            className="product-card"
            style={{
                width: '260px',
                margin: '0.5rem',
                cursor: 'pointer',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
            }}
            onClick={handleClick}
        >
            <div style={{ width: '100%', height: '180px', overflow: 'hidden' }}>
                <img
                    src={imgSrc}
                    alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
            <div style={{ padding: '0.75rem 1rem', flexGrow: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{name}</h3>
                <p
                    style={{
                        margin: 0,
                        fontSize: '0.9rem',
                        color: '#555',
                        minHeight: '2.7rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {description}
                </p>
            </div>
            <div
                style={{
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 600,
                }}
            >
                <span>{price.toFixed(2)} €</span>
                <span style={{ fontSize: '0.85rem', color: '#777' }}>Details</span>
            </div>
        </div>
    );
};
