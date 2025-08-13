// netlify/functions/publish-event.js - VERSION CORRIGÉE HTTP/2
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Test Puppeteer corrigé démarré');
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Seule la méthode POST est acceptée' })
        };
    }

    try {
        const eventData = JSON.parse(event.body);
        console.log('📝 Données reçues:', eventData.title);

        // Test Puppeteer avec configuration corrigée
        const puppeteerResult = await testPuppeteerFixed();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Test Puppeteer terminé',
                eventData: {
                    title: eventData.title,
                    date: eventData.date
                },
                puppeteerTest: puppeteerResult,
                debug: {
                    chromiumPath: await chromium.executablePath(),
                    timestamp: new Date().toISOString()
                }
            })
        };

    } catch (error) {
        console.error('❌ Erreur globale:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Erreur serveur',
                details: error.message,
                stack: error.stack
            })
        };
    }
};

async function testPuppeteerFixed() {
    console.log('🔍 Démarrage test Puppeteer corrigé...');
    let browser = null;
    
    try {
        // Configuration Puppeteer optimisée pour Netlify
        console.log('🌐 Lancement du navigateur avec config corrigée...');
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--deterministic-fetch',
                '--disable-features=VizDisplayCompositor',
                // Corrections pour HTTP/2 et réseau
                '--disable-http2',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-client-side-phishing-detection',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-sync',
                '--metrics-recording-only',
                '--no-default-browser-check',
                '--safebrowsing-disable-auto-update',
                '--disable-features=site-per-process'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 60000
        });

        console.log('✅ Navigateur lancé avec succès');

        const page = await browser.newPage();
        
        // Configuration page pour éviter les détections
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
        });
        
        console.log('📄 Page configurée');

        // Test 1: Site simple (httpbin pour tester la connectivité)
        console.log('🔗 Test connectivité basique...');
        try {
            await page.goto('https://httpbin.org/get', { 
                waitUntil: 'networkidle0',
                timeout: 20000 
            });
            console.log('✅ Connectivité basique OK');
        } catch (e) {
            console.log('❌ Problème connectivité basique:', e.message);
            throw new Error('Pas de connectivité réseau');
        }

        // Test 2: Google (HTTP/1.1 fallback)
        console.log('🔗 Navigation vers Google...');
        await page.goto('https://www.google.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 20000 
        });
        
        const title = await page.title();
        console.log('📖 Titre Google:', title);

        // Test 3: Eventim avec retry et timeout réduit
        console.log('🎫 Test Eventim...');
        let eventimResult = {};
        
        try {
            await page.goto('https://www.eventim-light.com', { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });
            
            const eventimTitle = await page.title();
            console.log('🎪 Titre Eventim:', eventimTitle);
            eventimResult.homepage = { success: true, title: eventimTitle };
            
        } catch (eventimError) {
            console.log('⚠️ Eventim homepage échec:', eventimError.message);
            eventimResult.homepage = { success: false, error: eventimError.message };
        }

        // Test 4: Page login Eventim
        try {
            console.log('🔐 Test page login Eventim...');
            await page.goto('https://www.eventim-light.com/fr/login', { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });
            
            const loginTitle = await page.title();
            console.log('🔑 Titre login:', loginTitle);
            
            // Test sélecteurs
            await page.waitForTimeout(2000); // Attendre le chargement
            const emailField = await page.$('input[type="email"], input[name="email"]');
            const passwordField = await page.$('input[type="password"], input[name="password"]');
            
            eventimResult.login = {
                success: true,
                title: loginTitle,
                emailField: !!emailField,
                passwordField: !!passwordField
            };
            
        } catch (loginError) {
            console.log('⚠️ Login page échec:', loginError.message);
            eventimResult.login = { success: false, error: loginError.message };
        }

        return {
            success: true,
            tests: {
                browserLaunch: true,
                basicConnectivity: true,
                googleNavigation: true,
                googleTitle: title,
                eventim: eventimResult
            },
            message: 'Tests Puppeteer terminés avec config corrigée'
        };

    } catch (error) {
        console.error('💥 Erreur Puppeteer:', error);
        return {
            success: false,
            error: error.message,
            message: 'Erreur lors des tests Puppeteer'
        };
    } finally {
        if (browser) {
            console.log('🔒 Fermeture du navigateur...');
            try {
                await browser.close();
            } catch (e) {
                console.log('⚠️ Erreur fermeture navigateur:', e.message);
            }
        }
    }
}
