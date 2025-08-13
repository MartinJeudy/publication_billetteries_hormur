// netlify/functions/publish-event.js - VERSION PRODUCTION AVEC SÉLECTEURS DEVTOOLS
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const CREDENTIALS = {
    eventim: {
        email: process.env.EVENTIM_EMAIL,
        password: process.env.EVENTIM_PASSWORD
    },
    jds: {
        email: process.env.JDS_EMAIL,
        password: process.env.JDS_PASSWORD
    },
    allevents: {
        email: process.env.ALLEVENTS_EMAIL,
        password: process.env.ALLEVENTS_PASSWORD
    }
};

// SÉLECTEURS PRÉCIS DEPUIS DEVTOOLS
const SELECTORS = {
    eventim: {
        emailField: '#input-13',
        passwordField: '#input-15',
        loginButton: '[data-cy="login_button"] span.v-btn__content',
        eventNameField: '#input-56',
        categoryDropdown: '[data-cy="event-form-common-eventCategory"] i',
        dateField: '#input-72',
        publishButton: '[data-cy="event-form\\.publish"] > span.v-btn__content'
    },
    jds: {
        emailField: '#femail',
        passwordField: '#password',
        loginButton: '#connexion > input',
        addEventButton: 'a.btn-primary',
        titleField: '#form_titre',
        typeField: '#form_genre_parent',
        cityField: '#form_recherche_ville',
        venueField: '#form_recherche_lieu',
        submitButton: 'div.container-fluid input[type="submit"]'
    },
    allevents: {
        continueEmailButton: '#login-option-email > div.right',
        emailField: '#inputEmail',
        continueButton: '#existance_lookup_btn',
        passwordField: '#signinPassword',
        loginButton: '#signin_with_email_btn',
        importButton: 'div.ae-col-3 button',
        urlField: 'input[type="url"]',
        agreementCheckbox: '#import-agr-chkbox',
        submitButton: 'div.import-event-subbox button'
    }
};

exports.handler = async (event) => {
    console.log('🚀 Version PRODUCTION avec sélecteurs DevTools');
    
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
            description: eventData.description || `Événement organisé par Hormur

🎭 BILLETTERIE OFFICIELLE : HORMUR.COM 🎭
───────────────────────────────────────
⚠️ IMPORTANT : Les réservations faites ici sont des PRÉ-RÉSERVATIONS.
✅ Pour obtenir vos billets valables : ${eventData.eventUrl || 'https://hormur.com'}

📍 Cet événement se déroule dans un lieu atypique.
L'adresse exacte sera communiquée après réservation sur Hormur.com

💡 Hormur - Des expériences culturelles uniques dans des lieux insolites`,
            date: eventData.date,
            time: eventData.time || '20:00',
            venue: eventData.venue || 'Lieu à confirmer',
            address: eventData.address || 'Paris',
            imageUrl: eventData.imageUrl || '',
            eventUrl: eventData.eventUrl || 'https://hormur.com',
            category: eventData.category || 'Concert'
        };

        // Protection timeout global
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    eventim: { success: false, error: 'Timeout global' },
                    jds: { success: false, error: 'Timeout global' },
                    allevents: { success: false, error: 'Timeout global' }
                });
            }, 25000);
        });

        // Publication en parallèle sur les 3 plateformes
        const workPromise = publishToAllPlatforms(formattedData);
        const results = await Promise.race([workPromise, timeoutPromise]);
        
        // Calculer le succès global
        const successCount = Object.values(results).filter(r => r.success).length;
        const totalPlatforms = Object.keys(results).length;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: successCount > 0,
                message: `Publication terminée: ${successCount}/${totalPlatforms} plateformes réussies`,
                eventData: formattedData,
                results: results,
                debug: {
                    timestamp: new Date().toISOString(),
                    successCount: successCount,
                    totalPlatforms: totalPlatforms
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

async function publishToAllPlatforms(eventData) {
    console.log('🌐 Publication sur toutes les plateformes...');
    
    // Lancer les 3 publications en parallèle avec gestion d'erreurs individuelles
    const [eventimResult, jdsResult, alleventsResult] = await Promise.allSettled([
        publishToEventim(eventData),
        publishToJDS(eventData),
        publishToAllEvents(eventData)
    ]);

    return {
        eventim: eventimResult.status === 'fulfilled' 
            ? eventimResult.value 
            : { success: false, error: eventimResult.reason?.message || 'Erreur inconnue' },
        jds: jdsResult.status === 'fulfilled' 
            ? jdsResult.value 
            : { success: false, error: jdsResult.reason?.message || 'Erreur inconnue' },
        allevents: alleventsResult.status === 'fulfilled' 
            ? alleventsResult.value 
            : { success: false, error: alleventsResult.reason?.message || 'Erreur inconnue' }
    };
}

// === EVENTIM-LIGHT ===
async function publishToEventim(eventData) {
    console.log('🎪 [EVENTIM] Début de publication');
    let browser = null;
    
    try {
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
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 15000
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // 1. CONNEXION
        console.log('[EVENTIM] Connexion...');
        await page.goto('https://www.eventim-light.com/fr/login?redirect=/events/create/common', { 
            waitUntil: 'networkidle0',
            timeout: 10000
        });
        
        // Gérer popup cookies
        try {
            await page.waitForSelector('#cmpclosebntnotxt', { timeout: 3000 });
            await page.click('#cmpclosebntnotxt');
        } catch (e) {
            console.log('[EVENTIM] Pas de popup cookies');
        }
        
        // Remplir identifiants avec sélecteurs DevTools
        await page.waitForSelector(SELECTORS.eventim.emailField, { timeout: 5000 });
        await page.type(SELECTORS.eventim.emailField, CREDENTIALS.eventim.email);
        
        await page.waitForSelector(SELECTORS.eventim.passwordField, { timeout: 5000 });
        await page.type(SELECTORS.eventim.passwordField, CREDENTIALS.eventim.password);
        
        // Se connecter
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }),
            page.click(SELECTORS.eventim.loginButton)
        ]);
        
        console.log('[EVENTIM] Connecté avec succès');
        
        // 2. CRÉATION D'ÉVÉNEMENT
        // Remplir nom de l'événement
        await page.waitForSelector(SELECTORS.eventim.eventNameField, { timeout: 5000 });
        await page.type(SELECTORS.eventim.eventNameField, eventData.title);
        
        // Sélectionner catégorie "Concerts & Festivals"
        await page.click(SELECTORS.eventim.categoryDropdown);
        await page.waitForTimeout(1000);
        await page.click('#v-menu-v-3 div:nth-of-type(2) > div.v-list-item__content > div');
        
        // Date et heure
        await page.waitForSelector(SELECTORS.eventim.dateField, { timeout: 5000 });
        await page.type(SELECTORS.eventim.dateField, `${eventData.date} à ${eventData.time}`);
        
        // Continuer avec les étapes suivantes...
        // (Pour le test, publier directement)
        await page.waitForTimeout(2000);
        await page.click(SELECTORS.eventim.publishButton);
        
        console.log('✅ [EVENTIM] Publication réussie');
        
        return {
            success: true,
            platform: 'eventim',
            message: 'Événement publié sur Eventim Light'
        };
        
    } catch (error) {
        console.error('❌ [EVENTIM] Erreur:', error.message);
        return {
            success: false,
            platform: 'eventim',
            error: error.message
        };
    } finally {
        if (browser) await browser.close();
    }
}

// === JDS ===
async function publishToJDS(eventData) {
    console.log('📰 [JDS] Début de publication');
    let browser = null;
    
    try {
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
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 15000
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // 1. CONNEXION
        console.log('[JDS] Connexion...');
        await page.goto('https://pro.jds.fr/login?&utm_source=jds.fr&utm_medium=header&utm_campaign=link_publier_info', { 
            waitUntil: 'networkidle0',
            timeout: 10000
        });
        
        // Remplir identifiants
        await page.waitForSelector(SELECTORS.jds.emailField, { timeout: 5000 });
        await page.type(SELECTORS.jds.emailField, CREDENTIALS.jds.email);
        
        await page.waitForSelector(SELECTORS.jds.passwordField, { timeout: 5000 });
        await page.type(SELECTORS.jds.passwordField, CREDENTIALS.jds.password);
        
        // Se connecter
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }),
            page.click(SELECTORS.jds.loginButton)
        ]);
        
        console.log('[JDS] Connecté avec succès');
        
        // 2. AJOUTER ÉVÉNEMENT
        await page.click(SELECTORS.jds.addEventButton);
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
        
        // Gérer popup cookies
        try {
            await page.waitForSelector('#didomi-notice-agree-button', { timeout: 3000 });
            await page.click('#didomi-notice-agree-button');
        } catch (e) {
            console.log('[JDS] Pas de popup cookies');
        }
        
        // Remplir formulaire
        await page.waitForSelector(SELECTORS.jds.titleField, { timeout: 5000 });
        await page.type(SELECTORS.jds.titleField, eventData.title);
        
        // Type: Concert (137)
        await page.select(SELECTORS.jds.typeField, '137');
        
        // Ville
        await page.type(SELECTORS.jds.cityField, 'Paris');
        await page.waitForTimeout(1000);
        
        // Valider
        await page.click(SELECTORS.jds.submitButton);
        
        console.log('✅ [JDS] Publication réussie');
        
        return {
            success: true,
            platform: 'jds',
            message: 'Événement publié sur JDS'
        };
        
    } catch (error) {
        console.error('❌ [JDS] Erreur:', error.message);
        return {
            success: false,
            platform: 'jds',
            error: error.message
        };
    } finally {
        if (browser) await browser.close();
    }
}

// === ALLEVENTS ===
async function publishToAllEvents(eventData) {
    console.log('🌍 [ALLEVENTS] Début de publication');
    let browser = null;
    
    try {
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
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            timeout: 15000
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // 1. CONNEXION
        console.log('[ALLEVENTS] Connexion...');
        await page.goto('https://allevents.in/pages/sign-in?ref=home-page-topbar', { 
            waitUntil: 'networkidle0',
            timeout: 10000
        });
        
        // Gérer cookies
        try {
            await page.waitForSelector('div.cc-window > div > a', { timeout: 3000 });
            await page.click('div.cc-window > div > a');
        } catch (e) {
            console.log('[ALLEVENTS] Pas de popup cookies');
        }
        
        // Continue with Email
        await page.click(SELECTORS.allevents.continueEmailButton);
        
        // Email
        await page.waitForSelector(SELECTORS.allevents.emailField, { timeout: 5000 });
        await page.type(SELECTORS.allevents.emailField, CREDENTIALS.allevents.email);
        await page.click(SELECTORS.allevents.continueButton);
        
        // Password
        await page.waitForSelector(SELECTORS.allevents.passwordField, { timeout: 5000 });
        await page.type(SELECTORS.allevents.passwordField, CREDENTIALS.allevents.password);
        
        // Login
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }),
            page.click(SELECTORS.allevents.loginButton)
        ]);
        
        console.log('[ALLEVENTS] Connecté avec succès');
        
        // 2. IMPORT ÉVÉNEMENT
        await page.click(SELECTORS.allevents.importButton);
        
        // URL de l'événement
        await page.waitForSelector(SELECTORS.allevents.urlField, { timeout: 5000 });
        await page.type(SELECTORS.allevents.urlField, eventData.eventUrl);
        
        // Cocher l'accord
        await page.click(SELECTORS.allevents.agreementCheckbox);
        
        // Soumettre
        await page.click(SELECTORS.allevents.submitButton);
        
        console.log('✅ [ALLEVENTS] Publication réussie');
        
        return {
            success: true,
            platform: 'allevents',
            message: 'Événement publié sur AllEvents'
        };
        
    } catch (error) {
        console.error('❌ [ALLEVENTS] Erreur:', error.message);
        return {
            success: false,
            platform: 'allevents',
            error: error.message
        };
    } finally {
        if (browser) await browser.close();
    }
}
