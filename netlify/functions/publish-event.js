// netlify/functions/publish-event.js - AUTOMATISATION RÉELLE (MODE TEST)
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Automatisation RÉELLE démarrée');
    
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

        // Publier sur Eventim (mode test pour commencer)
        const eventimResult = await publishToEventimReal(formattedData);
        
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

async function publishToEventimReal(eventData) {
    console.log('🎪 [EVENTIM] Début de l\'automatisation réelle');
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
        
        await page.waitForTimeout(3000); // Laisser la page se charger
        
        // ÉTAPE 2: Gérer les cookies si nécessaire
        try {
            const cookieButton = await page.$('[data-testid="cookie-accept-all"], button[id*="cookie"], button[class*="cookie"]');
            if (cookieButton) {
                await cookieButton.click();
                console.log('[EVENTIM] Cookies acceptés');
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('[EVENTIM] Pas de bannière cookies');
        }
        
        // ÉTAPE 3: Trouver et remplir le champ email
        console.log('[EVENTIM] Recherche du champ email...');
        
        // Essayer plusieurs sélecteurs pour l'email
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
            // Debug: prendre une capture des éléments de la page
            const allInputs = await page.$$eval('input', inputs => 
                inputs.map(input => ({
                    type: input.type,
                    name: input.name,
                    id: input.id,
                    placeholder: input.placeholder,
                    className: input.className
                }))
            );
            
            return {
                success: false,
                platform: 'eventim',
                error: 'Champ email non trouvé',
                debug: {
                    step: 'email_field_search',
                    allInputs: allInputs,
                    url: page.url(),
                    title: await page.title()
                }
            };
        }
        
        // ÉTAPE 4: Saisir l'email
        console.log('[EVENTIM] Saisie de l\'email...');
        await emailField.click();
        await page.waitForTimeout(500);
        await emailField.type(CREDENTIALS.eventim.email, { delay: 100 });
        
        // ÉTAPE 5: Trouver et remplir le mot de passe
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
        
        // ÉTAPE 6: Cliquer sur le bouton de connexion
        console.log('[EVENTIM] Recherche du bouton de connexion...');
        const loginSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Connexion")',
            'button:has-text("Se connecter")',
            'button:has-text("Login")',
            '[data-testid="login"]'
        ];
        
        let loginButton = null;
        for (const selector of loginSelectors) {
            try {
                loginButton = await page.$(selector);
                if (loginButton) {
                    const text = await loginButton.textContent();
                    console.log(`[EVENTIM] Bouton trouvé: "${text}" avec ${selector}`);
                    break;
                }
            } catch (e) {
                // Ignorer les erreurs de sélecteur
            }
        }
        
        if (!loginButton) {
            return {
                success: false,
                platform: 'eventim',
                error: 'Bouton de connexion non trouvé'
            };
        }
        
        // ÉTAPE 7: Se connecter
        console.log('[EVENTIM] Tentative de connexion...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
            loginButton.click()
        ]);
        
        console.log('[EVENTIM] Navigation après login, URL:', page.url());
        
        // ÉTAPE 8: Vérifier si la connexion a réussi
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
                    title: pageTitle
                }
            };
        }
        
        console.log('✅ [EVENTIM] Connexion réussie !');
        
        // ÉTAPE 9: Aller vers la création d'événement
        console.log('[EVENTIM] Navigation vers création d\'événement...');
        
        // Chercher le lien/bouton pour créer un événement
        const createEventSelectors = [
            'a[href*="nouvel"]',
            'a[href*="creer"]', 
            'a[href*="create"]',
            'a[href*="new"]',
            'button:has-text("Créer")',
            'button:has-text("Nouvel")',
            '[data-testid="create-event"]'
        ];
        
        let createButton = null;
        for (const selector of createEventSelectors) {
            try {
                createButton = await page.$(selector);
                if (createButton) {
                    console.log(`[EVENTIM] Bouton création trouvé avec: ${selector}`);
                    break;
                }
            } catch (e) {
                // Ignorer
            }
        }
        
        if (createButton) {
            await createButton.click();
            await page.waitForTimeout(3000);
        } else {
            // Essayer d'aller directement à l'URL de création
            await page.goto('https://www.eventim-light.com/fr/evenements', { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });
        }
        
        return {
            success: true,
            platform: 'eventim',
            message: `Test de connexion réussi ! Connecté en tant que ${CREDENTIALS.eventim.email}`,
            debug: {
                finalUrl: page.url(),
                finalTitle: await page.title(),
                step: 'login_completed'
            }
        };
        
    } catch (error) {
        console.error('❌ [EVENTIM] Erreur:', error.message);
        return {
            success: false,
            platform: 'eventim',
            error: error.message,
            debug: {
                step: 'unknown_error'
            }
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
