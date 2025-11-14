import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        // the base path for your deployed site
        base: '/pixel-garden/', 
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['tree.png', 'withered_tree.png', 'audio/mainbg.mp3', 'audio/titlescreen.mp3'],
                manifest: {
                    name: 'Pixel Garden',
                    short_name: 'PixelGarden',
                    description: 'Grow a pixel-perfect forest, harvest seeds, and upgrade your grove even when offline.',
                    theme_color: '#141718',
                    background_color: '#080808',
                    display: 'standalone',
                    orientation: 'portrait-primary',
                    scope: '/pixel-garden/',
                    start_url: '/pixel-garden/',
                    icons: [
                        {
                            src: 'icons/icon-192.png',
                            sizes: '192x192',
                            type: 'image/png',
                        },
                        {
                            src: 'icons/icon-512.png',
                            sizes: '512x512',
                            type: 'image/png',
                        },
                        {
                            src: 'icons/icon-512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any maskable',
                        },
                    ],
                },
                workbox: {
                    maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3}'],
                    runtimeCaching: [
                        {
                            urlPattern: ({ request }) => request.destination === 'document' || request.mode === 'navigate',
                            handler: 'NetworkFirst',
                            options: {
                                cacheName: 'pixel-garden-pages',
                                networkTimeoutSeconds: 5,
                            },
                        },
                        {
                            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
                            handler: 'StaleWhileRevalidate',
                            options: {
                                cacheName: 'pixel-garden-static',
                            },
                        },
                        {
                            urlPattern: ({ request }) => request.destination === 'image' || request.destination === 'audio',
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'pixel-garden-media',
                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                                },
                            },
                        },
                    ],
                },
                devOptions: {
                    enabled: true,
                    suppressWarnings: true,
                },
            })
        ],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        resolve: {
            alias: {
                // this is a cool alias trick
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});