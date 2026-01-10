import { API_CONTRACT_VERSION } from '../../index';

export const authOpenApi = {
    openapi: '3.0.3',
    info: {
        title: 'Auth/User Service',
        version: API_CONTRACT_VERSION,
        description: 'Authentication, session handling, and user profile management.',
    },
    servers: [{ url: '/api' }, { url: `/api/${API_CONTRACT_VERSION}` }],
    tags: [{ name: 'Auth' }, { name: 'Users' }],
    paths: {
        '/auth/signup': { post: { tags: ['Auth'], summary: 'Register a new user' } },
        '/auth/login': { post: { tags: ['Auth'], summary: 'Authenticate user credentials' } },
        '/auth/refresh': { post: { tags: ['Auth'], summary: 'Refresh session tokens' } },
        '/auth/logout': { post: { tags: ['Auth'], summary: 'Invalidate the current session' } },
        '/auth/verify': { get: { tags: ['Auth'], summary: 'Verify email address' } },
        '/auth/resend': { post: { tags: ['Auth'], summary: 'Resend verification email' } },
        '/users/me': {
            get: { tags: ['Users'], summary: 'Get current user profile' },
            put: { tags: ['Users'], summary: 'Update current user profile' },
            delete: { tags: ['Users'], summary: 'Delete current user account' },
        },
        '/users/me/password': { put: { tags: ['Users'], summary: 'Update current user password' } },
        '/users/me/preferences': { put: { tags: ['Users'], summary: 'Update user preferences' } },
        '/users': { get: { tags: ['Users'], summary: 'List all users (admin)' } },
        '/users/{id}': {
            get: { tags: ['Users'], summary: 'Get user profile by id' },
            put: { tags: ['Users'], summary: 'Update user profile by id (admin)' },
            delete: { tags: ['Users'], summary: 'Delete user by id (admin/self)' },
        },
    },
} as const;
