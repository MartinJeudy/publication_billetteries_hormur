// netlify/functions/publish-event.js - EVENTIM AVEC SÉLECTEURS CORRIGÉS
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

// SÉLECTEURS STABLES (PAR ATTRIBUT NAME - NE CHANGENT PAS)
const SELECTORS = {
    eventim: {
        emailField: 'input[name="username"]',    // STABLE: utilise l'attribut name
        passwordField: 'input[name="password"]', // STABLE: utilise l'attribut name  
        loginButton: '[data-cy="login_button"]', // Backup avec attributs
        // Autres sélecteurs à découvrir après connexion...
    }
};

exports.handler = async (event) => {
    console.log('🎪 Version EVENTIM avec sélecteurs STABLES (attributs name)');
    
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
        console.log('📝 Test connexion Eventim pour:', eventData.title);

        // Valider les données
        if (!eventData.title || !eventData.date) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Données manquantes',
                    required: ['title', 'date']
                })
            };
        }

        // Protection timeout
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: false,
                    error: 'Timeout de sécurité (30 secondes)'
                });
            }, 30000);
        });

        // Test connexion EVENTIM avec sélecteurs corrigés
        const workPromise = testEventimLoginFixed();
        const result = await Promise.race([workPromise, timeoutPromise]);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: result.success,
                message: result.success 
                    ? 'Connexion Eventim réussie avec sélecteurs STABLES !' 
                    : 'Échec connexion Eventim',
                eventTitle: eventData.title,
                results: {
                    eventim: result
                },
                debug: {
                    timestamp: new Date().toISOString(),
                    selectorsUsed: SELECTORS.eventim
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
                error: error.message
            })
        };
    }
};

async function testEventimLoginFixed() {
    console.log('🔐 Test connexion Eventim avec sélecteurs STABLES (attributs name)');
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-http2',
                '--disable-web-security'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 15000
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
        });
        
        console.log('🌐 Navigation vers login...');
        await page.goto('https://www.eventim-light.com/fr/login', { 
            waitUntil: 'networkidle0',
            timeout: 15000
        });
        
        console.log('⏱️ Attente chargement complet...');
        await page.waitForTimeout(3000);
        
        // Gérer popup cookies si présent
        try {
            const cookieButton = await page.$('#cmpclosebntnotxt');
            if (cookieButton) {
                await cookieButton.click();
                console.log('🍪 Popup cookies fermé');
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('🍪 Pas de popup cookies');
        }
        
        // UTILISER LES SÉLECTEURS CORRIGÉS
        console.log('📧 Remplissage email avec sélecteur stable...');
        await page.waitForSelector(SELECTORS.eventim.emailField, { timeout: 8000 });
        await page.click(SELECTORS.eventim.emailField);
        await page.type(SELECTORS.eventim.emailField, CREDENTIALS.eventim.email, { delay: 100 });
        console.log('✅ Email saisi avec input[name="username"]');
        
        console.log('🔒 Remplissage password avec sélecteur stable...');
        await page.waitForSelector(SELECTORS.eventim.passwordField, { timeout: 5000 });
        await page.click(SELECTORS.eventim.passwordField);
        await page.type(SELECTORS.eventim.passwordField, CREDENTIALS.eventim.password, { delay: 100 });
        console.log('✅ Password saisi avec input[name="password"]');
        
        // Chercher le bouton de connexion
        console.log('🔘 Recherche bouton connexion...');
        let loginButton = null;
        
        // Méthode 1: data-cy
        try {
            loginButton = await page.$(SELECTORS.eventim.loginButton);
            if (loginButton) {
                console.log('✅ Bouton trouvé via data-cy');
            }
        } catch (e) {
            console.log('❌ data-cy non trouvé');
        }
        
        // Méthode 2: XPath par texte
        if (!loginButton) {
            try {
                const buttons = await page.$x('//button[contains(text(), "Connexion") or contains(text(), "Login") or contains(text(), "Einloggen")]');
                if (buttons.length > 0) {
                    loginButton = buttons[0];
                    console.log('✅ Bouton trouvé via XPath');
                }
            } catch (e) {
                console.log('❌ XPath non trouvé');
            }
        }
        
        // Méthode 3: Premier bouton submit
        if (!loginButton) {
            loginButton = await page.$('button[type="submit"]');
            if (loginButton) {
                console.log('✅ Bouton trouvé via submit');
            }
        }
        
        if (!loginButton) {
            // Debug: lister tous les boutons
            const allButtons = await page.$$eval('button', buttons => 
                buttons.map(btn => ({
                    text: btn.textContent?.trim(),
                    type: btn.type,
                    className: btn.className,
                    dataCy: btn.getAttribute('data-cy')
                }))
            );
            
            return {
                success: false,
                error: 'Bouton connexion non trouvé',
                debug: {
                    allButtons: allButtons,
                    emailFieldFound: true,
                    passwordFieldFound: true,
                    currentUrl: page.url()
                }
            };
        }
        
        console.log('🚀 Tentative de connexion...');
        
        // Cliquer et attendre navigation
        try {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
                loginButton.click()
            ]);
        } catch (navError) {
            // Si navigation échoue, juste cliquer et attendre
            await loginButton.click();
            await page.waitForTimeout(5000);
        }
        
        // Vérifier le succès de la connexion
        const finalUrl = page.url();
        const finalTitle = await page.title();
        
        console.log(`🎯 Après connexion: ${finalUrl}`);
        
        if (finalUrl.includes('login')) {
            return {
                success: false,
                error: 'Connexion échouée - encore sur login',
                debug: {
                    finalUrl: finalUrl,
                    finalTitle: finalTitle,
                    selectorsUsed: {
                        email: SELECTORS.eventim.emailField,
                        password: SELECTORS.eventim.passwordField
                    }
                }
            };
        }
        
        console.log('✅ Connexion Eventim réussie !');
        
        return {
            success: true,
            platform: 'eventim',
            message: 'Connexion Eventim réussie avec sélecteurs STABLES (attributs name) !',
            debug: {
                finalUrl: finalUrl,
                finalTitle: finalTitle,
                selectorsWorked: true,
                emailSelector: SELECTORS.eventim.emailField,
                passwordSelector: SELECTORS.eventim.passwordField
            }
        };
        
    } catch (error) {
        console.error('❌ Erreur connexion:', error.message);
        return {
            success: false,
            error: error.message,
            debug: {
                step: 'connection_test',
                selectorsUsed: SELECTORS.eventim
            }
        };
    } finally {
        if (browser) {
            console.log('🔒 Fermeture navigateur');
            await browser.close();
        }
    }
}
