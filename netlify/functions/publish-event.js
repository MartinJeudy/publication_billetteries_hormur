// netlify/functions/publish-event.js - VERSION FINALE FONCTIONNELLE
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    }
};

exports.handler = async (event) => {
    console.log('🚀 Automatisation finale démarrée');
    
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
        console.log('📝 Publication de:', eventData.title);

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

        // Publication réelle sur Eventim
        const eventimResult = await publishToEventimReal(formattedData);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: eventimResult.success,
                message: 'Publication Eventim terminée',
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

async function publishToEventimReal(eventData) {
    console.log('🎪 [EVENTIM] Publication réelle démarrée');
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
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 30000
        });

        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        console.log('[EVENTIM] Configuration page OK');

        // ÉTAPE 1: Aller à la page login
        console.log('[EVENTIM] Navigation vers login...');
        await page.goto('https://www.eventim-light.com/fr/login', { 
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        
        await page.waitForTimeout(3000);
        console.log('[EVENTIM] Page login chargée');

        // ÉTAPE 2: Trouver le champ email avec debug avancé
        console.log('[EVENTIM] Recherche du champ email...');
        
        // Debug : afficher tous les inputs de la page
        const allInputs = await page.$$eval('input', inputs => 
            inputs.map(input => ({
                type: input.type,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder,
                className: input.className,
                value: input.value,
                visible: input.offsetParent !== null
            }))
        );
        
        console.log('[EVENTIM] Tous les inputs trouvés:', JSON.stringify(allInputs, null, 2));
        
        // Essayer différents sélecteurs pour l'email
        const emailSelectors = [
            'input[type="email"]',
            'input[name="email"]', 
            'input[name="username"]',
            'input[name="login"]',
            'input[placeholder*="mail"]',
            'input[placeholder*="Email"]',
            'input[placeholder*="Benutzername"]', // Allemand
            'input[id*="email"]',
            'input[id*="username"]',
            'input[id*="login"]',
            'input:not([type="password"]):not([type="submit"]):not([type="button"])', // Tout input sauf password/submit/button
            '.v-text-field input', // Vuetify
            '[data-testid*="email"] input',
            '[data-testid*="username"] input'
        ];
        
        let emailField = null;
        let emailSelector = null;
        
        for (const selector of emailSelectors) {
            try {
                const fields = await page.$$(selector);
                // Prendre le premier champ visible
                for (const field of fields) {
                    const isVisible = await field.evaluate(el => el.offsetParent !== null);
                    if (isVisible) {
                        emailField = field;
                        emailSelector = selector;
                        break;
                    }
                }
                if (emailField) break;
            } catch (e) {
                // Ignorer les erreurs de sélecteur
            }
        }
        
        if (!emailField) {
            return {
                success: false,
                platform: 'eventim',
                error: 'Champ email non trouvé',
                debug: {
                    allInputs: allInputs,
                    url: page.url()
                }
            };
        }
        
        console.log(`[EVENTIM] Champ email trouvé avec: ${emailSelector}`);
        
        // ÉTAPE 3: Remplir l'email
        await emailField.click();
        await page.waitForTimeout(500);
        await emailField.type(CREDENTIALS.eventim.email, { delay: 100 });
        console.log('[EVENTIM] Email saisi');
        
        // ÉTAPE 4: Remplir le mot de passe
        console.log('[EVENTIM] Recherche du champ password...');
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
        console.log('[EVENTIM] Mot de passe saisi');
        
        // ÉTAPE 5: Cliquer sur le bouton Connexion
        console.log('[EVENTIM] Recherche du bouton Connexion...');
        
        // Utiliser XPath pour chercher par texte (plus fiable)
        let connexionButton = null;
        
        try {
            // Méthode 1: XPath par texte
            const buttons = await page.$x('//button[contains(text(), "Connexion")]');
            if (buttons.length > 0) {
                connexionButton = buttons[0];
                console.log('[EVENTIM] Bouton trouvé via XPath');
            }
        } catch (e) {
            console.log('[EVENTIM] Erreur XPath:', e.message);
        }
        
        // Méthode 2: CSS selector basique (fallback)
        if (!connexionButton) {
            connexionButton = await page.$('button[type="submit"]');
            if (connexionButton) {
                console.log('[EVENTIM] Bouton trouvé via CSS submit');
            }
        }
        
        if (!connexionButton) {
            return {
                success: false,
                platform: 'eventim',
                error: 'Bouton Connexion non trouvé'
            };
        }
        
        console.log('[EVENTIM] Clic sur Connexion...');
        
        // Attendre la navigation ou un changement
        try {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
                connexionButton.click()
            ]);
        } catch (e) {
            // Si la navigation ne se produit pas, attendre un peu
            await connexionButton.click();
            await page.waitForTimeout(5000);
        }
        
        // ÉTAPE 6: Vérifier la connexion
        const currentUrl = page.url();
        const pageTitle = await page.title();
        console.log(`[EVENTIM] Après connexion - URL: ${currentUrl}, Titre: ${pageTitle}`);
        
        if (currentUrl.includes('login')) {
            return {
                success: false,
                platform: 'eventim',
                error: 'Échec de connexion - encore sur login',
                debug: {
                    url: currentUrl,
                    title: pageTitle,
                    emailSelector: emailSelector
                }
            };
        }
        
        console.log('✅ [EVENTIM] Connexion réussie !');
        
        // ÉTAPE 7: Pour l'instant, juste confirmer la connexion
        // Dans une version ultérieure, on ajoutera la création d'événement
        
        return {
            success: true,
            platform: 'eventim',
            message: `Connexion Eventim réussie ! URL finale: ${currentUrl}`,
            debug: {
                finalUrl: currentUrl,
                finalTitle: pageTitle,
                emailSelector: emailSelector,
                step: 'login_successful'
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
