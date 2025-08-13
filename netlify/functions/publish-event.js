// netlify/functions/publish-event.js - DEBUG NAVIGATION EVENTIM
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

exports.handler = async (event) => {
    console.log('🔍 DEBUG Navigation Eventim');
    
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
        console.log('🔍 Debug navigation pour:', eventData.title);

        // Protection timeout
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: false,
                    error: 'Timeout de sécurité debug (30 secondes)'
                });
            }, 30000);
        });

        const workPromise = debugEventimNavigation();
        const result = await Promise.race([workPromise, timeoutPromise]);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: result.success,
                message: 'Debug navigation terminé',
                debugInfo: result,
                debug: {
                    timestamp: new Date().toISOString()
                }
            })
        };

    } catch (error) {
        console.error('💥 Erreur debug:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

async function debugEventimNavigation() {
    console.log('🔍 Debug navigation Eventim étape par étape');
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
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 15000
        });

        console.log('✅ Navigateur lancé');
        const page = await browser.newPage();
        console.log('✅ Page créée');
        
        // Configuration page
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        console.log('✅ Page configurée');
        
        // Test 1: Naviguer vers la homepage d'abord
        console.log('🏠 Test 1: Navigation vers homepage Eventim...');
        let homepageTitle = 'unknown';
        let homepageUrl = 'unknown';
        
        try {
            await page.goto('https://www.eventim-light.com', { 
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
            
            homepageTitle = await page.title();
            homepageUrl = page.url();
            console.log(`✅ Homepage accessible: ${homepageTitle} - ${homepageUrl}`);
            
        } catch (e) {
            console.log(`❌ Homepage inaccessible: ${e.message}`);
            return {
                success: false,
                error: 'Homepage Eventim inaccessible',
                details: e.message,
                currentUrl: page.url()
            };
        }
        
        // Test 2: Naviguer vers la page login simple
        console.log('🔐 Test 2: Navigation vers page login simple...');
        try {
            await page.goto('https://www.eventim-light.com/fr/login', { 
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
            
            const loginTitle = await page.title();
            const loginUrl = page.url();
            console.log(`✅ Page login accessible: ${loginTitle} - ${loginUrl}`);
            
            // Attendre que la page se charge complètement
            await page.waitForTimeout(3000);
            
            // Vérifier quels inputs sont présents
            const allInputs = await page.$$eval('input', inputs => 
                inputs.map(input => ({
                    id: input.id,
                    type: input.type,
                    name: input.name,
                    placeholder: input.placeholder,
                    className: input.className,
                    visible: input.offsetParent !== null
                }))
            );
            
            console.log(`📊 Inputs trouvés: ${allInputs.length}`);
            
            // Chercher spécifiquement #input-13
            const input13 = await page.$('#input-13');
            const hasInput13 = !!input13;
            
            return {
                success: true,
                navigation: {
                    homepage: {
                        accessible: true,
                        title: homepageTitle,
                        url: homepageUrl
                    },
                    loginPage: {
                        accessible: true,
                        title: loginTitle,
                        url: loginUrl,
                        inputsFound: allInputs.length,
                        allInputs: allInputs,
                        hasInput13: hasInput13
                    }
                },
                message: 'Navigation debug réussie'
            };
            
        } catch (e) {
            console.log(`❌ Page login inaccessible: ${e.message}`);
            
            return {
                success: false,
                error: 'Page login Eventim inaccessible',
                details: e.message,
                navigation: {
                    homepage: {
                        accessible: true,
                        title: homepageTitle,
                        url: homepageUrl
                    },
                    loginPage: {
                        accessible: false,
                        error: e.message
                    }
                }
            };
        }
        
    } catch (error) {
        console.error('❌ Erreur debug navigation:', error.message);
        return {
            success: false,
            error: error.message,
            step: 'browser_launch_or_config'
        };
    } finally {
        if (browser) {
            console.log('🔒 Fermeture navigateur debug');
            await browser.close();
        }
    }
}
