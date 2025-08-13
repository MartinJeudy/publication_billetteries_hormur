// netlify/functions/publish-event.js - VERSION DIAGNOSTIC ULTRA-SIMPLE
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

exports.handler = async (event) => {
    console.log('🚀 Version diagnostic démarrée');
    
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

    // PROTECTION CONTRE LES CRASHES
    try {
        console.log('📝 Début du traitement...');
        
        const eventData = JSON.parse(event.body);
        console.log('✅ JSON parsé avec succès');

        // Test 1: Vérifier les variables d'environnement
        const hasEmail = !!process.env.EVENTIM_EMAIL;
        const hasPassword = !!process.env.EVENTIM_PASSWORD;
        
        console.log('🔑 Variables d\'env - Email:', hasEmail, 'Password:', hasPassword);

        if (!hasEmail || !hasPassword) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Variables d\'environnement manquantes',
                    debug: { hasEmail, hasPassword }
                })
            };
        }

        // Test 2: Essayer juste de lancer Puppeteer (sans aller sur aucun site)
        console.log('🌐 Test lancement Puppeteer minimal...');
        
        const puppeteerResult = await testMinimalPuppeteer();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Test diagnostic terminé',
                eventTitle: eventData.title,
                credentials: { hasEmail, hasPassword },
                puppeteer: puppeteerResult,
                debug: {
                    nodeVersion: process.version,
                    timestamp: new Date().toISOString(),
                    chromiumPath: await chromium.executablePath()
                }
            })
        };

    } catch (error) {
        console.error('💥 ERREUR FATALE:', error);
        
        // Réponse d'urgence même en cas d'erreur grave
        try {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Erreur fatale dans la fonction',
                    details: error.message,
                    stack: error.stack,
                    type: error.constructor.name
                })
            };
        } catch (jsonError) {
            // Si même le JSON.stringify échoue, retourner du texte brut
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/plain' },
                body: `ERREUR CRITIQUE: ${error.message}`
            };
        }
    }
};

async function testMinimalPuppeteer() {
    console.log('🔍 Test Puppeteer minimal...');
    let browser = null;
    
    try {
        console.log('📂 Récupération du chemin Chromium...');
        const executablePath = await chromium.executablePath();
        console.log('✅ Chemin Chromium:', executablePath);
        
        console.log('🚀 Lancement du navigateur...');
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-http2'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: executablePath,
            headless: chromium.headless,
            timeout: 30000  // 30 secondes max
        });
        
        console.log('✅ Navigateur lancé');
        
        console.log('📄 Création d\'une page...');
        const page = await browser.newPage();
        console.log('✅ Page créée');
        
        console.log('🌐 Navigation vers une page ultra-simple...');
        await page.goto('data:text/html,<h1>Test OK</h1>', { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });
        
        const title = await page.title();
        console.log('📖 Titre récupéré:', title);
        
        console.log('🔒 Fermeture du navigateur...');
        await browser.close();
        browser = null;
        
        return {
            success: true,
            message: 'Puppeteer fonctionne parfaitement',
            pageTitle: title,
            chromiumPath: executablePath
        };
        
    } catch (error) {
        console.error('❌ Erreur Puppeteer:', error.message);
        
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('❌ Erreur fermeture browser:', closeError.message);
            }
        }
        
        return {
            success: false,
            error: error.message,
            errorType: error.constructor.name,
            step: 'puppeteer_test'
        };
    }
}
