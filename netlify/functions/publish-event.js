// netlify/functions/publish-event.js - CORRECTION BOUTON CONNEXION
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Automatisation avec détection bouton améliorée');
    
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
        console.log('📝 Événement à publier:', eventData.title);

        // Valider les données requises
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

        // Formater les données
        const formattedData = {
            title: eventData.title,
            description: eventData.description || '',
            date: eventData.date,
            time: eventData.time || '20:00',
            venue: eventData.venue || 'Lieu à confirmer',
            address: eventData.address || 'Paris',
            imageUrl: eventData.imageUrl || '',
            eventUrl: eventData.eventUrl || 'https://hormur.com',
            category: eventData.category || 'Concert'
        };

        // Publier sur Eventim avec détection bouton améliorée
        const eventimResult = await publishToEventimImproved(formattedData);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Publication testée',
                eventData: formattedData,
                results: {
                    eventim: eventimResult
                },
                debug: {
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
                details: error.message
            })
        };
    }
};

async function publishToEventimImproved(eventData) {
    console.log('🎪 [EVENTIM] Automatisation avec détection bouton améliorée');
    let browser = null;
    
    try {
        // Configuration Puppeteer optimisée
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-http2',
                '--disable-features=VizDisplayCompositor',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 60000
        });

        const page = await browser.newPage();
        
        // Configuration page
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
        });
        
        console.log('📄 Page configurée');

        // ÉTAPE 1: Aller à la page de login
        console.log('[EVENTIM] Navigation vers login...');
        await page.goto('https://www.eventim-light.com/fr/login', { 
            waitUntil: 'domcontentloaded',
            timeout: 20000 
        });
        
        await page.waitForTimeout(3000);
        
        // ÉTAPE 2: Gérer les cookies
        try {
            const cookieButton = await page.$('[data-testid="cookie-accept-all"], button[id*="cookie"], button[class*="cookie"], .cookie-accept');
            if (cookieButton) {
                await cookieButton.click();
                console.log('[EVENTIM] Cookies acceptés');
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('[EVENTIM] Pas de bannière cookies');
        }
        
        // ÉTAPE 3: Trouver et remplir l'email
        console.log('[EVENTIM] Recherche du champ email...');
        
        const emailSelectors = [
            'input[type="email"]',
            'input[name="email"]', 
            'input[name="username"]',
            'input[placeholder*="mail"]',
            'input[placeholder*="Email"]',
            '#email',
            '[data-testid="email"]'
        ];
        
        let emailField = null;
        for (const selector of emailSelectors) {
            emailField = await page.$(selector);
            if (emailField) {
                console.log(`[EVENTIM] Champ email trouvé avec: ${selector}`);
                break;
            }
        }
        
        if (!emailField) {
            return {
                success: false,
                platform: 'eventim',
                error: 'Champ email non trouvé'
            };
        }
        
        await emailField.click();
        await page.waitForTimeout(500);
        await emailField.type(CREDENTIALS.eventim.email, { delay: 100 });
        
        // ÉTAPE 4: Remplir le mot de passe
        console.log('[EVENTIM] Recherche du champ mot de passe...');
        const passwordField = await page.$('input[type="password"]');
        
        if (!passwordField) {
            return {
                success: false,
                platform: 'eventim',
                error: 'Champ mot de passe non trouvé'
            };
        }
        
        await passwordField.click();
        await page.waitForTimeout(500);
        await passwordField.type(CREDENTIALS.eventim.password, { delay: 100 });
        
        // ÉTAPE 5: DÉTECTION AMÉLIORÉE DU BOUTON
        console.log('[EVENTIM] Recherche avancée du bouton de connexion...');
        
        // D'abord, faire un debug de tous les boutons disponibles
        const allButtons = await page.$$eval('button, input[type="submit"], input[type="button"], a[role="button"]', buttons => 
            buttons.map(btn => ({
                tagName: btn.tagName,
                type: btn.type,
                textContent: btn.textContent?.trim(),
                innerHTML: btn.innerHTML,
                className: btn.className,
                id: btn.id,
                role: btn.role,
                formAction: btn.formAction,
                onclick: btn.onclick ? 'has_onclick' : null
            }))
        );
        
        console.log('[EVENTIM] Boutons trouvés sur la page:', JSON.stringify(allButtons, null, 2));
        
        // Essayer plusieurs méthodes pour trouver le bouton
        let loginButton = null;
        let loginMethod = null;
        
        // Méthode 1: Sélecteurs directs
        const loginSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:contains("Connexion")',
            'button:contains("Se connecter")',
            'button:contains("Login")',
            'button:contains("Einloggen")',
            '[data-testid="login"]',
            '[data-testid="submit"]',
            '.login-button',
            '.submit-button'
        ];
        
        for (const selector of loginSelectors) {
            try {
                loginButton = await page.$(selector);
                if (loginButton) {
                    loginMethod = `selector: ${selector}`;
                    console.log(`[EVENTIM] Bouton trouvé avec: ${selector}`);
                    break;
                }
            } catch (e) {
                // Ignorer
            }
        }
        
        // Méthode 2: Chercher par texte avec XPath
        if (!loginButton) {
            try {
                const xpathSelectors = [
                    '//button[contains(text(), "Connexion")]',
                    '//button[contains(text(), "Se connecter")]', 
                    '//button[contains(text(), "Login")]',
                    '//button[contains(text(), "Einloggen")]',
                    '//input[@type="submit"]',
                    '//button[@type="submit"]'
                ];
                
                for (const xpath of xpathSelectors) {
                    try {
                        const elements = await page.$x(xpath);
                        if (elements.length > 0) {
                            loginButton = elements[0];
                            loginMethod = `xpath: ${xpath}`;
                            console.log(`[EVENTIM] Bouton trouvé avec XPath: ${xpath}`);
                            break;
                        }
                    } catch (e) {
                        // Ignorer
                    }
                }
            } catch (e) {
                console.log('[EVENTIM] Erreur XPath:', e.message);
            }
        }
        
        // Méthode 3: Chercher le formulaire et le soumettre directement
        if (!loginButton) {
            try {
                console.log('[EVENTIM] Tentative de soumission directe du formulaire...');
                const form = await page.$('form');
                if (form) {
                    await form.evaluate(form => form.submit());
                    loginMethod = 'form_submit';
                    console.log('[EVENTIM] Formulaire soumis directement');
                } else {
                    return {
                        success: false,
                        platform: 'eventim',
                        error: 'Aucun bouton de connexion trouvé et pas de formulaire',
                        debug: {
                            allButtons: allButtons,
                            url: page.url(),
                            title: await page.title()
                        }
                    };
                }
            } catch (e) {
                return {
                    success: false,
                    platform: 'eventim',
                    error: 'Impossible de soumettre le formulaire',
                    debug: {
                        allButtons: allButtons,
                        submitError: e.message
                    }
                };
            }
        }
        
        // ÉTAPE 6: Cliquer sur le bouton ou soumettre
        if (loginButton && loginMethod !== 'form_submit') {
            console.log('[EVENTIM] Clic sur le bouton de connexion...');
            try {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
                    loginButton.click()
                ]);
            } catch (e) {
                // Si la navigation échoue, essayer juste le clic
                await loginButton.click();
                await page.waitForTimeout(3000);
            }
        } else if (loginMethod === 'form_submit') {
            // Attendre après soumission directe
            await page.waitForTimeout(5000);
        }
        
        console.log('[EVENTIM] Navigation après login, URL:', page.url());
        
        // ÉTAPE 7: Vérifier le succès de la connexion
        await page.waitForTimeout(3000);
        const currentUrl = page.url();
        const pageTitle = await page.title();
        
        if (currentUrl.includes('login') || pageTitle.toLowerCase().includes('login')) {
            return {
                success: false,
                platform: 'eventim',
                error: 'Échec de la connexion - encore sur la page login',
                debug: {
                    url: currentUrl,
                    title: pageTitle,
                    loginMethod: loginMethod,
                    allButtons: allButtons
                }
            };
        }
        
        console.log('✅ [EVENTIM] Connexion réussie !');
        
        return {
            success: true,
            platform: 'eventim',
            message: `Connexion réussie avec la méthode: ${loginMethod}`,
            debug: {
                finalUrl: currentUrl,
                finalTitle: pageTitle,
                loginMethod: loginMethod,
                buttonsFound: allButtons.length
            }
        };
        
    } catch (error) {
        console.error('❌ [EVENTIM] Erreur:', error.message);
        return {
            success: false,
            platform: 'eventim',
            error: error.message
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
