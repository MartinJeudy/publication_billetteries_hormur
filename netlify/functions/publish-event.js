// netlify/functions/publish-event.js - TEST PROGRESSIF EVENTIM
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Test progressif Eventim démarré');
    
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

        // Test progressif d'accès à Eventim
        const eventimTest = await testEventimAccess();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Test progressif Eventim terminé',
                eventTitle: eventData.title,
                eventimTest: eventimTest,
                debug: {
                    timestamp: new Date().toISOString()
                }
            })
        };

    } catch (error) {
        console.error('💥 Erreur:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
};

async function testEventimAccess() {
    console.log('🎪 Test d\'accès progressif à Eventim');
    let browser = null;
    
    try {
        // Configuration Puppeteer avec timeouts réduits
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-http2',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 30000
        });

        const page = await browser.newPage();
        
        // Configuration anti-détection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        console.log('📄 Page configurée');

        const results = {};

        // ÉTAPE 1: Test site simple d'abord
        console.log('🌐 Test 1: Site simple (httpbin.org)...');
        try {
            await page.goto('https://httpbin.org/get', { 
                waitUntil: 'domcontentloaded',
                timeout: 10000 
            });
            results.simpleTest = { success: true, message: 'Site simple accessible' };
            console.log('✅ Site simple OK');
        } catch (e) {
            results.simpleTest = { success: false, error: e.message };
            console.log('❌ Site simple KO:', e.message);
        }

        // ÉTAPE 2: Test Eventim homepage avec timeout court
        console.log('🎪 Test 2: Eventim homepage...');
        try {
            await page.goto('https://www.eventim-light.com', { 
                waitUntil: 'domcontentloaded',
                timeout: 8000  // Timeout très court
            });
            
            const title = await page.title();
            const url = page.url();
            results.eventimHomepage = { 
                success: true, 
                title: title,
                url: url,
                message: 'Homepage accessible'
            };
            console.log('✅ Eventim homepage OK:', title);
            
        } catch (e) {
            results.eventimHomepage = { success: false, error: e.message };
            console.log('❌ Eventim homepage KO:', e.message);
            
            // Si homepage échoue, pas la peine de continuer
            return {
                success: false,
                message: 'Eventim homepage inaccessible',
                results: results
            };
        }

        // ÉTAPE 3: Test page login avec timeout court
        console.log('🔐 Test 3: Page login...');
        try {
            await page.goto('https://www.eventim-light.com/fr/login', { 
                waitUntil: 'domcontentloaded',
                timeout: 8000
            });
            
            const loginTitle = await page.title();
            const loginUrl = page.url();
            
            // Attendre un peu que la page se charge
            await page.waitForTimeout(2000);
            
            // Chercher les champs principaux
            const emailField = await page.$('input[type="email"], input[name="email"]');
            const passwordField = await page.$('input[type="password"]');
            
            results.eventimLogin = {
                success: true,
                title: loginTitle,
                url: loginUrl,
                hasEmailField: !!emailField,
                hasPasswordField: !!passwordField,
                message: 'Page login accessible'
            };
            console.log('✅ Page login OK');
            
        } catch (e) {
            results.eventimLogin = { success: false, error: e.message };
            console.log('❌ Page login KO:', e.message);
            
            return {
                success: false,
                message: 'Page login inaccessible',
                results: results
            };
        }

        // ÉTAPE 4: Test simple de remplissage (SANS soumission)
        console.log('✍️ Test 4: Remplissage des champs (test)...');
        try {
            // Trouver et remplir l'email
            const emailField = await page.$('input[type="email"], input[name="email"]');
            if (emailField) {
                await emailField.click();
                await page.waitForTimeout(500);
                await emailField.type('test@example.com', { delay: 50 }); // Email de test
                console.log('✅ Champ email rempli');
            }
            
            // Trouver et remplir le mot de passe
            const passwordField = await page.$('input[type="password"]');
            if (passwordField) {
                await passwordField.click();
                await page.waitForTimeout(500);
                await passwordField.type('testpassword', { delay: 50 }); // Mot de passe de test
                console.log('✅ Champ password rempli');
            }
            
            // Chercher les boutons (SANS cliquer)
            const buttons = await page.$$eval('button, input[type="submit"]', btns => 
                btns.map(btn => ({
                    tag: btn.tagName,
                    type: btn.type,
                    text: btn.textContent?.trim(),
                    className: btn.className,
                    id: btn.id
                }))
            );
            
            results.formTest = {
                success: true,
                message: 'Formulaire testé sans soumission',
                emailFilled: !!emailField,
                passwordFilled: !!passwordField,
                buttonsFound: buttons.length,
                buttons: buttons
            };
            
            console.log('✅ Test formulaire OK, boutons trouvés:', buttons.length);
            
        } catch (e) {
            results.formTest = { success: false, error: e.message };
            console.log('❌ Test formulaire KO:', e.message);
        }

        return {
            success: true,
            message: 'Tests progressifs terminés avec succès',
            results: results
        };
        
    } catch (error) {
        console.error('❌ Erreur globale:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Erreur lors des tests progressifs'
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
