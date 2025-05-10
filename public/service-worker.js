// Nome da versão do cache
const CACHE_NAME = 'app-cache-v1';

// Arquivos para armazenar no cache
const FILES_TO_CACHE = [
    './', // Cache da raiz do site
    './index.html', // Certifique-se que o nome está correto no seu projeto
    './styles.css', // Certifique-se que o arquivo de estilo está correto
    './icon.png', // Ícone usado no manifest
    './icon-.png', // Ícone usado no manifest (opcional)
    './service-worker.js'
];

// Evento de instalação
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Fazendo cache dos arquivos...');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
});

// Evento de ativação
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Removendo cache antigo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Evento de busca (fetch)
self.addEventListener('fetch', (event) => {
    console.log('[Service Worker] Capturando recurso:', event.request.url);
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                console.log('[Service Worker] Servindo do cache:', event.request.url);
                return response; // Retorna o arquivo do cache
            }
            console.log('[Service Worker] Fazendo fetch do recurso:', event.request.url);
            return fetch(event.request); // Faz a requisição na rede
        })
    );
});