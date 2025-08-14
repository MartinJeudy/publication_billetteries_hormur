// netlify/functions/publish-event.js - VERSION ULTRA-SÉCURISÉE
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🛡️ Version ULTRA-SÉCURISÉE démarrée');
    
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

    // TRIPLE PROTECTION CONTRE LES CRASHES
    let result = null;
    
    try {
        const eventData = JSON.parse(event.body);
        console.log('📝 Test ultra-court pour:', eventData.title);

        // TIMEOUT ULTRA-COURT - 15 secondes MAX
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                console.log('⏰ TIMEOUT 15s atteint');
                resolve({
                    success: false,
                    error: 'Timeout ultra-court (15s)',
                    message: 'Interrompu pour éviter crash Netlify'
                });
            }, 15000);
        });

        const workPromise = ultraQuickTest();
        result = await Promise.race([workPromise, timeoutPromise]);
        
    } catch (outerError) {
        console.error('💥 Erreur niveau 1:', outerError);
        result = {
            success: false,
            error: 'Erreur niveau 1: ' + outerError.message,
            type: 'outer_catch'
        };
    }

    // PROTECTION FINALE DE LA RÉPONSE
    try {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: result?.success || false,
                message: 'Test ultra-sécurisé terminé',
                result: result,
                debug: {
                    timestamp: new Date().toISOString(),
                    protection: 'triple-layer'
                }
            })
        };
    } catch (jsonError) {
        console.error('💥 Erreur JSON final:', jsonError);
        // DERNIER RECOURS: Texte pur
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/plain' },
            body: `ERREUR JSON: ${jsonError.message}. Result: ${JSON.stringify(result)}`
        };
    }
};

async function ultraQuickTest() {
    console.log('⚡ Test ultra-rapide Eventim');
    let browser = null;
    
    try {
        console.log('🚀 Lancement navigateur ultra-rapide...');
        
        // Configuration minimaliste
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-http2',
                '--disable-images',
                '--disable-javascript', // Désactiver JS pour aller plus vite
                '--disable-plugins',
                '--disable-extensions'
            ],
            defaultViewport: { width: 800, height: 600 }, // Plus petit
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 8000 // Timeout très court pour le launch
        });

        const page = await browser.newPage();
        console.log('📄 Page créée');
        
        // Configuration ultra-basique
        await page.setUserAgent('Mozilla/5.0 (compatible; Bot)');
        
        // Test 1: Juste aller à la page login (RIEN d'autre)
        console.log('🌐 Navigation ultra-rapide vers login...');
        await page.goto('https://www.eventim-light.com/fr/login', { 
            waitUntil: 'domcontentloaded',
            timeout: 5000 // Timeout très court
        });
        
        const title = await page.title();
        const url = page.url();
        console.log(`✅ Page atteinte: ${title}`);
        
        // Test 2: Juste vérifier si les champs existent (SANS les remplir)
        console.log('🔍 Vérification rapide champs...');
        await page.waitForTimeout(2000); // Attente courte
        
        const emailExists = await page.$('input[name="username"]') !== null;
        const passwordExists = await page.$('input[name="password"]') !== null;
        
        console.log(`📧 Email field: ${emailExists ? 'OUI' : 'NON'}`);
        console.log(`🔒 Password field: ${passwordExists ? 'OUI' : 'NON'}`);
        
        return {
            success: true,
            platform: 'eventim',
            message: 'Test ultra-rapide réussi - SANS connexion',
            debug: {
                title: title,
                url: url,
                emailFieldExists: emailExists,
                passwordFieldExists: passwordExists,
                mode: 'ultra-quick-no-login'
            }
        };
        
    } catch (error) {
        console.error('❌ Erreur test ultra-rapide:', error.message);
        return {
            success: false,
            platform: 'eventim',
            error: error.message,
            debug: {
                step: 'ultra_quick_failed',
                mode: 'no-login-attempt'
            }
        };
    } finally {
        if (browser) {
            console.log('🔒 Fermeture navigateur ultra-rapide');
            try {
                await browser.close();
            } catch (closeError) {
                console.log('⚠️ Erreur fermeture:', closeError.message);
            }
        }
    }
}
