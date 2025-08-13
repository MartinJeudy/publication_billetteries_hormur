// netlify/functions/publish-event.js - TEST PUPPETEER PROGRESSIF
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Test Puppeteer démarré');
    
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

        // Test Puppeteer simple : juste ouvrir une page
        const puppeteerResult = await testPuppeteer();
        
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
                    chromiumVersion: await chromium.executablePath(),
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

async function testPuppeteer() {
    console.log('🔍 Démarrage test Puppeteer...');
    let browser = null;
    
    try {
        // Configuration Puppeteer pour Netlify
        console.log('🌐 Lancement du navigateur...');
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
                '--disable-features=VizDisplayCompositor'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless
        });

        console.log('✅ Navigateur lancé avec succès');

        const page = await browser.newPage();
        console.log('📄 Nouvelle page créée');

        // Test 1: Page simple (Google)
        console.log('🔗 Navigation vers Google...');
        await page.goto('https://www.google.com', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        const title = await page.title();
        console.log('📖 Titre de la page:', title);

        // Test 2: Essayer Eventim (juste la page d'accueil)
        console.log('🎫 Navigation vers Eventim...');
        await page.goto('https://www.eventim-light.com', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        const eventimTitle = await page.title();
        console.log('🎪 Titre Eventim:', eventimTitle);

        // Test 3: Vérifier si on peut voir la page de login
        try {
            console.log('🔐 Test navigation vers login...');
            await page.goto('https://www.eventim-light.com/fr/login', { 
                waitUntil: 'networkidle0',
                timeout: 20000 
            });
            
            const loginTitle = await page.title();
            console.log('🔑 Page login titre:', loginTitle);
            
            // Chercher le champ email
            const emailField = await page.$('input[type="email"]');
            const hasEmailField = !!emailField;
            console.log('📧 Champ email trouvé:', hasEmailField);
            
            return {
                success: true,
                tests: {
                    browserLaunch: true,
                    googleNavigation: true,
                    googleTitle: title,
                    eventimNavigation: true,
                    eventimTitle: eventimTitle,
                    loginNavigation: true,
                    loginTitle: loginTitle,
                    emailFieldFound: hasEmailField
                },
                message: 'Tous les tests Puppeteer réussis'
            };
            
        } catch (loginError) {
            console.log('⚠️ Erreur sur la page login:', loginError.message);
            return {
                success: false,
                tests: {
                    browserLaunch: true,
                    googleNavigation: true,
                    googleTitle: title,
                    eventimNavigation: true,
                    eventimTitle: eventimTitle,
                    loginNavigation: false,
                    loginError: loginError.message
                },
                message: 'Erreur lors de l\'accès à la page login'
            };
        }

    } catch (error) {
        console.error('💥 Erreur Puppeteer:', error);
        return {
            success: false,
            error: error.message,
            step: 'browser_launch',
            message: 'Échec du lancement du navigateur'
        };
    } finally {
        if (browser) {
            console.log('🔒 Fermeture du navigateur...');
            await browser.close();
        }
    }
}
