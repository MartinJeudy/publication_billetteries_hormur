// netlify/functions/publish-event.js - VERSION MINIMALISTE ANTI-TIMEOUT
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Version minimaliste anti-timeout');
    
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
        console.log('📝 Test pour:', eventData.title);

        // PROTECTION TIMEOUT: Promise avec timeout strict
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: false,
                    platform: 'eventim',
                    error: 'Timeout de sécurité (8 secondes)',
                    message: 'Fonction interrompue pour éviter timeout Netlify'
                });
            }, 8000); // 8 secondes max
        });

        const workPromise = quickEventimTest();

        // Course entre le travail et le timeout
        const eventimResult = await Promise.race([workPromise, timeoutPromise]);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: eventimResult.success,
                message: 'Test rapide terminé',
                eventTitle: eventData.title,
                results: {
                    eventim: eventimResult
                },
                debug: {
                    timestamp: new Date().toISOString(),
                    protectedByTimeout: true
                }
            })
        };

    } catch (error) {
        console.error('💥 Erreur:', error);
        
        // Réponse d'urgence même en cas d'erreur
        try {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: error.message,
                    type: 'caught_error'
                })
            };
        } catch (jsonError) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/plain' },
                body: `ERREUR: ${error.message}`
            };
        }
    }
};

async function quickEventimTest() {
    console.log('⚡ Test Eventim ultra-rapide');
    let browser = null;
    
    try {
        console.log('🚀 Lancement navigateur...');
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-http2',
                '--disable-images', // Accélérer
                '--disable-javascript', // Accélérer si possible
                '--disable-plugins'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 10000 // 10s max pour le launch
        });

        const page = await browser.newPage();
        console.log('📄 Page créée');
        
        // Configuration basique
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Test 1: Juste aller à la page login (SANS remplir)
        console.log('🔐 Navigation rapide vers login...');
        await page.goto('https://www.eventim-light.com/fr/login', { 
            waitUntil: 'domcontentloaded',
            timeout: 5000 // Timeout très court
        });
        
        const title = await page.title();
        const url = page.url();
        console.log(`✅ Page atteinte: ${title}`);
        
        // Test 2: Juste vérifier que les champs existent (SANS remplir)
        console.log('🔍 Vérification rapide des champs...');
        const passwordExists = await page.$('input[type="password"]') !== null;
        
        // Chercher un input pour l'email (rapide)
        const allInputs = await page.$$('input');
        const emailField = allInputs.length > 0 ? allInputs[0] : null; // Premier input trouvé
        
        console.log('✅ Test rapide terminé');
        
        return {
            success: true,
            platform: 'eventim',
            message: 'Test rapide réussi - Page login accessible',
            debug: {
                title: title,
                url: url,
                passwordFieldExists: passwordExists,
                inputFieldsFound: allInputs.length,
                quickTest: true
            }
        };
        
    } catch (error) {
        console.error('❌ Erreur test rapide:', error.message);
        return {
            success: false,
            platform: 'eventim',
            error: error.message,
            debug: {
                step: 'quick_test_failed'
            }
        };
    } finally {
        if (browser) {
            console.log('🔒 Fermeture navigateur...');
            try {
                await browser.close();
            } catch (e) {
                console.log('⚠️ Erreur fermeture:', e.message);
            }
        }
    }
}
